import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];

type PresetModule = typeof import('../src/deposit/presets');
type EnvironmentModule = typeof import('../src/core/env');

type WorktreeSnapshot = {
  clean: true;
  headRef: string;
  envSha256: string;
  dataSha256: string;
};

type ParityMetadata = WorktreeSnapshot & {
  worktreePath: string;
  makeId: string;
  seedArtifact: string;
  seedSha256: string;
  normalizedArtifact: string;
  normalizedSha256: string;
};

type WorktreeApproval = {
  version: 1;
  worktreePath: string;
  headRef: string;
  envSha256: string;
  dataSha256: string;
};

type SingleRunOptions = {
  worktreePath: string;
  expectedRef: string;
  expectedEnvSha256?: string;
  expectedDataSha256?: string;
  approvalFilePath: string;
  outputDirectoryPath: string;
};

const FIXED_MAKE_ID = (prefix: string): string => `${prefix}fixed-id`;
const MAKE_ID_IDENTITY = '(prefix: string) => `${prefix}fixed-id`';
const SEED_ARTIFACT_NAME = 'seed-store.json';
const NORMALIZED_ARTIFACT_NAME = 'normalized-store.json';
const METADATA_ARTIFACT_NAME = 'parity-metadata.json';
const HARNESS_SCRIPT_PATH = fileURLToPath(import.meta.url);
const MAX_CHILD_OUTPUT_BYTES = 10 * 1024 * 1024;
const CANDIDATE_TIMEOUT_MS = 60_000;
const execFile = promisify(execFileCallback);

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const canonicalize = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key] as JsonValue)]),
    );
  }

  return value;
};

const formatCanonicalJson = (value: JsonValue): string =>
  `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await lstat(filePath);
    return true;
  } catch (error: unknown) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false;
    }

    throw error;
  }
};

const canonicalizePath = async (filePath: string): Promise<string> => {
  const absolutePath = resolve(filePath);
  let existingPath = absolutePath;

  while (!(await pathExists(existingPath))) {
    const parentPath = dirname(existingPath);
    if (parentPath === existingPath) {
      throw new Error(`Unable to resolve path: ${filePath}`);
    }

    existingPath = parentPath;
  }

  const canonicalExistingPath = await realpath(existingPath);
  return join(canonicalExistingPath, relative(existingPath, absolutePath));
};

const isPathWithin = (parentPath: string, candidatePath: string): boolean => {
  const relativePath = relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
};

const assertPathOutsideWorktrees = async (
  candidatePath: string,
  worktreePaths: readonly string[],
  label: string,
): Promise<void> => {
  const canonicalCandidatePath = await canonicalizePath(candidatePath);

  for (const worktreePath of worktreePaths) {
    const canonicalWorktreePath = await realpath(worktreePath);
    if (isPathWithin(canonicalWorktreePath, canonicalCandidatePath)) {
      throw new Error(`${label} must be outside the worktree: ${candidatePath}`);
    }
  }
};

const getCandidateEnvironment = (): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_OPTIONAL_LOCKS: '0',
  };
  const path = process.env.PATH;
  if (path !== undefined) {
    environment.PATH = path;
  }

  return environment;
};

const parseEnvironmentFile = (content: string): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    environment[key] = value;
  }

  return environment;
};

const runGit = async (worktreePath: string, args: readonly string[]): Promise<string> => {
  try {
    const result = await execFile(
      'git',
      ['-c', 'core.fsmonitor=false', '-C', worktreePath, ...args],
      {
        encoding: 'utf8',
        maxBuffer: MAX_CHILD_OUTPUT_BYTES,
        env: getCandidateEnvironment(),
      },
    );
    return result.stdout.trimEnd();
  } catch (error: unknown) {
    throw new Error(`Git command failed for worktree ${worktreePath}: ${getErrorMessage(error)}`);
  }
};

const isGitCommit = (value: string): boolean => /^[a-f0-9]{40}$/.test(value);
const isSha256 = (value: string): boolean => /^[a-f0-9]{64}$/.test(value);

const validateExpectedChecksum = (value: string | undefined, name: string): void => {
  if (value !== undefined && !isSha256(value)) {
    throw new Error(`${name} must be a lowercase SHA-256 checksum.`);
  }
};

const parseWorktreeApproval = (value: unknown, filePath: string): WorktreeApproval => {
  if (!isJsonObject(value)) {
    throw new Error(`Invalid worktree approval object: ${filePath}`);
  }

  const version = value.version;
  const worktreePath = value.worktreePath;
  const headRef = value.headRef;
  const envSha256 = value.envSha256;
  const dataSha256 = value.dataSha256;

  if (
    version !== 1 ||
    typeof worktreePath !== 'string' ||
    typeof headRef !== 'string' ||
    !isGitCommit(headRef) ||
    typeof envSha256 !== 'string' ||
    typeof dataSha256 !== 'string' ||
    !isSha256(envSha256) ||
    !isSha256(dataSha256)
  ) {
    throw new Error(`Invalid worktree approval fields: ${filePath}`);
  }

  return {
    version: 1,
    worktreePath,
    headRef,
    envSha256,
    dataSha256,
  };
};

const readWorktreeApproval = async (
  approvalFilePath: string,
  worktreePath: string,
): Promise<WorktreeApproval> => {
  const canonicalApprovalFilePath = await canonicalizePath(approvalFilePath);
  const canonicalWorktreePath = await realpath(worktreePath);
  if (isPathWithin(canonicalWorktreePath, canonicalApprovalFilePath)) {
    throw new Error(`Approval file must be outside the worktree: ${approvalFilePath}`);
  }

  const parsed: unknown = JSON.parse(await readFile(canonicalApprovalFilePath, 'utf8'));
  const approval = parseWorktreeApproval(parsed, canonicalApprovalFilePath);
  const approvedWorktreePath = await canonicalizePath(approval.worktreePath);
  if (approvedWorktreePath !== canonicalWorktreePath) {
    throw new Error(`Worktree approval does not match the requested worktree: ${worktreePath}`);
  }

  return approval;
};

const assertApprovedSnapshot = async (
  worktreePath: string,
  snapshot: WorktreeSnapshot,
  approvalFilePath: string,
): Promise<void> => {
  const approval = await readWorktreeApproval(approvalFilePath, worktreePath);
  if (approval.headRef !== snapshot.headRef) {
    throw new Error(
      `Worktree approval HEAD does not match: approved ${approval.headRef}, got ${snapshot.headRef}`,
    );
  }

  if (approval.envSha256 !== snapshot.envSha256) {
    throw new Error('Worktree approval .env.test checksum does not match the current input.');
  }

  if (approval.dataSha256 !== snapshot.dataSha256) {
    throw new Error('Worktree approval data/deposit checksum does not match the current input.');
  }
};

const hashFile = async (filePath: string): Promise<string> =>
  createHash('sha256').update(await readFile(filePath)).digest('hex');

const loadModule = async <T>(filePath: string): Promise<T> =>
  import(pathToFileURL(filePath).href) as Promise<T>;

const listFiles = async (directoryPath: string): Promise<string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort();
};

const hashFiles = async (rootDirectoryPath: string): Promise<string> => {
  const hash = createHash('sha256');
  const files = await listFiles(rootDirectoryPath);

  for (const filePath of files) {
    hash.update(relative(rootDirectoryPath, filePath));
    hash.update('\0');
    hash.update(await readFile(filePath));
    hash.update('\0');
  }

  return hash.digest('hex');
};

const getWorktreeSnapshot = async (worktreePath: string): Promise<WorktreeSnapshot> => {
  const [headRef, status] = await Promise.all([
    runGit(worktreePath, ['rev-parse', '--verify', 'HEAD']),
    runGit(worktreePath, ['status', '--porcelain=v1', '--untracked-files=all']),
  ]);

  if (status !== '') {
    throw new Error(`Worktree must be clean before parity execution: ${worktreePath}\n${status}`);
  }

  const envFilePath = join(worktreePath, '.env.test');
  const dataDirectoryPath = join(worktreePath, 'data', 'deposit');
  const [envSha256, dataSha256] = await Promise.all([
    hashFile(envFilePath),
    hashFiles(dataDirectoryPath),
  ]);

  return {
    clean: true,
    headRef,
    envSha256,
    dataSha256,
  };
};

const resolveExpectedRef = async (worktreePath: string, expectedRef: string): Promise<string> =>
  runGit(worktreePath, ['rev-parse', '--verify', `${expectedRef}^{commit}`]);

const assertExpectedSnapshot = async (
  worktreePath: string,
  snapshot: WorktreeSnapshot,
  expectedRef: string,
  expectedEnvSha256: string | undefined,
  expectedDataSha256: string | undefined,
): Promise<void> => {
  const expectedCommit = await resolveExpectedRef(worktreePath, expectedRef);
  if (snapshot.headRef !== expectedCommit) {
    throw new Error(
      `Worktree HEAD does not match ${expectedRef}: expected ${expectedCommit}, got ${snapshot.headRef}`,
    );
  }

  if (expectedEnvSha256 !== undefined && snapshot.envSha256 !== expectedEnvSha256) {
    throw new Error(
      `Worktree .env.test checksum does not match the expected input: expected ${expectedEnvSha256}, got ${snapshot.envSha256}`,
    );
  }

  if (expectedDataSha256 !== undefined && snapshot.dataSha256 !== expectedDataSha256) {
    throw new Error(
      `Worktree data/deposit checksum does not match the expected input: expected ${expectedDataSha256}, got ${snapshot.dataSha256}`,
    );
  }
};

const createWorktreeApproval = async (args: string[]): Promise<void> => {
  const worktreePath = await realpath(resolve(readRequiredArgument(args, '--worktree')));
  const approvalFilePath = resolve(readRequiredArgument(args, '--approval-file'));
  const expectedRef = readRequiredArgument(args, '--expected-ref');
  const expectedEnvSha256 = readOptionalArgument(args, '--expected-env-sha256');
  const expectedDataSha256 = readOptionalArgument(args, '--expected-data-sha256');
  validateExpectedChecksum(expectedEnvSha256, '--expected-env-sha256');
  validateExpectedChecksum(expectedDataSha256, '--expected-data-sha256');

  await assertPathOutsideWorktrees(approvalFilePath, [worktreePath], 'Approval file');
  if (await pathExists(approvalFilePath)) {
    throw new Error(`Approval file already exists; choose a new path: ${approvalFilePath}`);
  }

  const snapshot = await getWorktreeSnapshot(worktreePath);
  await assertExpectedSnapshot(
    worktreePath,
    snapshot,
    expectedRef,
    expectedEnvSha256,
    expectedDataSha256,
  );

  const approval: WorktreeApproval = {
    version: 1,
    worktreePath,
    headRef: snapshot.headRef,
    envSha256: snapshot.envSha256,
    dataSha256: snapshot.dataSha256,
  };
  await mkdir(dirname(approvalFilePath), { recursive: true });
  await writeFile(
    approvalFilePath,
    formatCanonicalJson(approval as unknown as JsonValue),
    'utf8',
  );
  console.log(`APPROVAL_FILE=${approvalFilePath}`);
  console.log(`HEAD_REF=${approval.headRef}`);
  console.log(`ENV_SHA256=${approval.envSha256}`);
  console.log(`DATA_SHA256=${approval.dataSha256}`);
};

const assertSnapshotUnchanged = (
  before: WorktreeSnapshot,
  after: WorktreeSnapshot,
  worktreePath: string,
): void => {
  if (!after.clean) {
    throw new Error(`Worktree is no longer clean during parity execution: ${worktreePath}`);
  }

  if (before.headRef !== after.headRef) {
    throw new Error(`Worktree HEAD changed during parity execution: ${worktreePath}`);
  }

  if (before.envSha256 !== after.envSha256) {
    throw new Error(`.env.test changed during parity execution: ${worktreePath}`);
  }

  if (before.dataSha256 !== after.dataSha256) {
    throw new Error(`data/deposit changed during parity execution: ${worktreePath}`);
  }
};

const assertSameInputIdentity = (
  baseSnapshot: WorktreeSnapshot,
  headSnapshot: WorktreeSnapshot,
): void => {
  if (baseSnapshot.envSha256 !== headSnapshot.envSha256) {
    throw new Error(
      `Parity inputs differ: .env.test checksums are ${baseSnapshot.envSha256} and ${headSnapshot.envSha256}`,
    );
  }

  if (baseSnapshot.dataSha256 !== headSnapshot.dataSha256) {
    throw new Error(
      `Parity inputs differ: data/deposit checksums are ${baseSnapshot.dataSha256} and ${headSnapshot.dataSha256}`,
    );
  }
};

const writeArtifact = async (filePath: string, value: JsonValue): Promise<string> => {
  const content = formatCanonicalJson(value);
  await writeFile(filePath, content, 'utf8');
  return createHash('sha256').update(content).digest('hex');
};

const readRequiredArgument = (args: string[], name: string): string => {
  const argumentIndex = args.indexOf(name);
  const value = args[argumentIndex + 1];
  if (argumentIndex === -1 || !value || value.startsWith('--')) {
    throw new Error(`Usage: bun run scripts/deposit-presets-parity.ts ${name} <path> ...`);
  }

  return value;
};

const readOptionalArgument = (args: string[], name: string): string | undefined => {
  const argumentIndex = args.indexOf(name);
  if (argumentIndex === -1) {
    return undefined;
  }

  const value = args[argumentIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Usage: bun run scripts/deposit-presets-parity.ts ${name} <value> ...`);
  }

  return value;
};

const parseParityMetadata = (value: unknown, filePath: string): ParityMetadata => {
  if (!isJsonObject(value)) {
    throw new Error(`Invalid parity metadata object: ${filePath}`);
  }

  const clean = value.clean;
  const worktreePath = value.worktreePath;
  const makeId = value.makeId;
  const headRef = value.headRef;
  const envSha256 = value.envSha256;
  const dataSha256 = value.dataSha256;
  const seedArtifact = value.seedArtifact;
  const seedSha256 = value.seedSha256;
  const normalizedArtifact = value.normalizedArtifact;
  const normalizedSha256 = value.normalizedSha256;

  if (
    clean !== true ||
    typeof worktreePath !== 'string' ||
    typeof makeId !== 'string' ||
    typeof headRef !== 'string' ||
    typeof envSha256 !== 'string' ||
    typeof dataSha256 !== 'string' ||
    typeof seedArtifact !== 'string' ||
    typeof seedSha256 !== 'string' ||
    typeof normalizedArtifact !== 'string' ||
    typeof normalizedSha256 !== 'string' ||
    !isSha256(envSha256) ||
    !isSha256(dataSha256) ||
    !isSha256(seedSha256) ||
    !isSha256(normalizedSha256)
  ) {
    throw new Error(`Invalid parity metadata fields: ${filePath}`);
  }

  return {
    clean: true,
    worktreePath,
    makeId,
    headRef,
    envSha256,
    dataSha256,
    seedArtifact,
    seedSha256,
    normalizedArtifact,
    normalizedSha256,
  };
};

const readParityMetadata = async (outputDirectoryPath: string): Promise<ParityMetadata> => {
  const metadataPath = join(outputDirectoryPath, METADATA_ARTIFACT_NAME);
  const parsed: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
  return parseParityMetadata(parsed, metadataPath);
};

const assertMetadataMatchesSnapshot = (
  metadata: ParityMetadata,
  snapshot: WorktreeSnapshot,
  worktreePath: string,
): void => {
  if (
    !metadata.clean ||
    metadata.headRef !== snapshot.headRef ||
    metadata.envSha256 !== snapshot.envSha256 ||
    metadata.dataSha256 !== snapshot.dataSha256
  ) {
    throw new Error(`Parity metadata changed during execution: ${worktreePath}`);
  }
};

const runCandidate = async (options: SingleRunOptions): Promise<ParityMetadata> => {
  const worktreePath = await realpath(options.worktreePath);
  const expectedRef = options.expectedRef;
  const expectedEnvSha256 = options.expectedEnvSha256;
  const expectedDataSha256 = options.expectedDataSha256;
  const approvalFilePath = resolve(options.approvalFilePath);
  const outputDirectoryPath = resolve(options.outputDirectoryPath);
  validateExpectedChecksum(expectedEnvSha256, '--expected-env-sha256');
  validateExpectedChecksum(expectedDataSha256, '--expected-data-sha256');

  await assertPathOutsideWorktrees(approvalFilePath, [worktreePath], 'Approval file');
  await assertPathOutsideWorktrees(outputDirectoryPath, [worktreePath], 'Output directory');
  if (await pathExists(outputDirectoryPath)) {
    throw new Error(`Output directory already exists; choose a new path: ${outputDirectoryPath}`);
  }

  const envFilePath = join(worktreePath, '.env.test');
  const dataDirectoryPath = join(worktreePath, 'data', 'deposit');
  const beforeSnapshot = await getWorktreeSnapshot(worktreePath);
  await assertExpectedSnapshot(
    worktreePath,
    beforeSnapshot,
    expectedRef,
    expectedEnvSha256,
    expectedDataSha256,
  );
  await assertApprovedSnapshot(worktreePath, beforeSnapshot, approvalFilePath);

  const environment = parseEnvironmentFile(await readFile(envFilePath, 'utf8'));
  const envModule = await loadModule<EnvironmentModule>(join(worktreePath, 'src/core/env.ts'));
  const presetModule = await loadModule<PresetModule>(join(worktreePath, 'src/deposit/presets.ts'));
  const env = envModule.getCliEnv(environment);
  const seedStore = presetModule.createSeedDepositPresets(env, FIXED_MAKE_ID);
  const normalizedStore = await presetModule.loadDepositPresets({
    dirPath: dataDirectoryPath,
    env,
    makeId: FIXED_MAKE_ID,
  });

  const afterSnapshot = await getWorktreeSnapshot(worktreePath);
  assertSnapshotUnchanged(beforeSnapshot, afterSnapshot, worktreePath);

  const outputParentPath = dirname(outputDirectoryPath);
  const outputDirectoryName = basename(outputDirectoryPath);
  await mkdir(outputParentPath, { recursive: true });
  const stagingDirectoryPath = await mkdtemp(
    join(outputParentPath, `.${outputDirectoryName}.staging-`),
  );
  let published = false;

  try {
    const stagingSeedArtifactPath = join(stagingDirectoryPath, SEED_ARTIFACT_NAME);
    const stagingNormalizedArtifactPath = join(stagingDirectoryPath, NORMALIZED_ARTIFACT_NAME);
    const [seedChecksum, normalizedChecksum] = await Promise.all([
      writeArtifact(stagingSeedArtifactPath, seedStore as unknown as JsonValue),
      writeArtifact(stagingNormalizedArtifactPath, normalizedStore as unknown as JsonValue),
    ]);

    const prePublishSnapshot = await getWorktreeSnapshot(worktreePath);
    assertSnapshotUnchanged(beforeSnapshot, prePublishSnapshot, worktreePath);

    const metadata: ParityMetadata = {
      ...prePublishSnapshot,
      worktreePath,
      makeId: MAKE_ID_IDENTITY,
      seedArtifact: SEED_ARTIFACT_NAME,
      seedSha256: seedChecksum,
      normalizedArtifact: NORMALIZED_ARTIFACT_NAME,
      normalizedSha256: normalizedChecksum,
    };
    const stagingMetadataArtifactPath = join(stagingDirectoryPath, METADATA_ARTIFACT_NAME);
    const metadataChecksum = await writeArtifact(
      stagingMetadataArtifactPath,
      metadata as unknown as JsonValue,
    );
    const artifactStats = await Promise.all([
      stat(stagingSeedArtifactPath),
      stat(stagingNormalizedArtifactPath),
      stat(stagingMetadataArtifactPath),
    ]);

    await rename(stagingDirectoryPath, outputDirectoryPath);
    published = true;

    const finalSnapshot = await getWorktreeSnapshot(worktreePath);
    assertSnapshotUnchanged(beforeSnapshot, finalSnapshot, worktreePath);

    const seedArtifactPath = join(outputDirectoryPath, SEED_ARTIFACT_NAME);
    const normalizedArtifactPath = join(outputDirectoryPath, NORMALIZED_ARTIFACT_NAME);
    const metadataArtifactPath = join(outputDirectoryPath, METADATA_ARTIFACT_NAME);
    console.log(`WORKTREE=${worktreePath}`);
    console.log(`HEAD_REF=${finalSnapshot.headRef}`);
    console.log(`WORKTREE_CLEAN=${finalSnapshot.clean}`);
    console.log(`ENV_SOURCE=${envFilePath}`);
    console.log(`ENV_SHA256=${finalSnapshot.envSha256}`);
    console.log(`DATA_SOURCE=${dataDirectoryPath}`);
    console.log(`DATA_SHA256=${finalSnapshot.dataSha256}`);
    console.log(`MAKE_ID=${MAKE_ID_IDENTITY}`);
    console.log(`SEED_ARTIFACT=${seedArtifactPath}`);
    console.log(`SEED_BYTES=${artifactStats[0]?.size ?? 0}`);
    console.log(`SEED_SHA256=${seedChecksum}`);
    console.log(`NORMALIZED_ARTIFACT=${normalizedArtifactPath}`);
    console.log(`NORMALIZED_BYTES=${artifactStats[1]?.size ?? 0}`);
    console.log(`NORMALIZED_SHA256=${normalizedChecksum}`);
    console.log(`METADATA_ARTIFACT=${metadataArtifactPath}`);
    console.log(`METADATA_BYTES=${artifactStats[2]?.size ?? 0}`);
    console.log(`METADATA_SHA256=${metadataChecksum}`);
    return metadata;
  } catch (error: unknown) {
    if (published) {
      await rm(outputDirectoryPath, { recursive: true, force: true });
    }
    throw error;
  } finally {
    if (!published) {
      await rm(stagingDirectoryPath, { recursive: true, force: true });
    }
  }
};

const runSingle = async (options: SingleRunOptions): Promise<ParityMetadata> => {
  const worktreePath = await realpath(options.worktreePath);
  const approvalFilePath = resolve(options.approvalFilePath);
  const outputDirectoryPath = resolve(options.outputDirectoryPath);
  validateExpectedChecksum(options.expectedEnvSha256, '--expected-env-sha256');
  validateExpectedChecksum(options.expectedDataSha256, '--expected-data-sha256');

  await assertPathOutsideWorktrees(approvalFilePath, [worktreePath], 'Approval file');
  await assertPathOutsideWorktrees(outputDirectoryPath, [worktreePath], 'Output directory');
  if (await pathExists(outputDirectoryPath)) {
    throw new Error(`Output directory already exists; choose a new path: ${outputDirectoryPath}`);
  }

  const beforeSnapshot = await getWorktreeSnapshot(worktreePath);
  await assertExpectedSnapshot(
    worktreePath,
    beforeSnapshot,
    options.expectedRef,
    options.expectedEnvSha256,
    options.expectedDataSha256,
  );
  await assertApprovedSnapshot(worktreePath, beforeSnapshot, approvalFilePath);

  try {
    await runHarnessChild({
      ...options,
      worktreePath,
      approvalFilePath,
      outputDirectoryPath,
    });
    const metadata = await readParityMetadata(outputDirectoryPath);
    assertMetadataMatchesSnapshot(metadata, beforeSnapshot, worktreePath);
    const finalSnapshot = await getWorktreeSnapshot(worktreePath);
    assertSnapshotUnchanged(beforeSnapshot, finalSnapshot, worktreePath);
    return metadata;
  } catch (error: unknown) {
    if (await pathExists(outputDirectoryPath)) {
      await rm(outputDirectoryPath, { recursive: true, force: true });
    }
    throw error;
  }
};

const runHarnessChild = async (options: SingleRunOptions): Promise<void> => {
  const args = [
    HARNESS_SCRIPT_PATH,
    '--candidate-only',
    '--worktree',
    options.worktreePath,
    '--expected-ref',
    options.expectedRef,
    '--approval-file',
    options.approvalFilePath,
    '--output-dir',
    options.outputDirectoryPath,
  ];
  if (options.expectedEnvSha256 !== undefined) {
    args.push('--expected-env-sha256', options.expectedEnvSha256);
  }
  if (options.expectedDataSha256 !== undefined) {
    args.push('--expected-data-sha256', options.expectedDataSha256);
  }

  try {
    const result = await execFile(process.execPath, args, {
      encoding: 'utf8',
      maxBuffer: MAX_CHILD_OUTPUT_BYTES,
      env: getCandidateEnvironment(),
      timeout: CANDIDATE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
  } catch (error: unknown) {
    throw new Error(`Parity run failed for ${options.worktreePath}: ${getErrorMessage(error)}`);
  }
};

const compareArtifacts = async (
  baseOutputDirectoryPath: string,
  headOutputDirectoryPath: string,
  artifactName: string,
): Promise<void> => {
  const [baseContent, headContent] = await Promise.all([
    readFile(join(baseOutputDirectoryPath, artifactName)),
    readFile(join(headOutputDirectoryPath, artifactName)),
  ]);
  if (Buffer.compare(baseContent, headContent) !== 0) {
    throw new Error(`Parity mismatch in ${artifactName}.`);
  }
};

const compareWorktrees = async (args: string[]): Promise<void> => {
  const baseWorktreePath = await realpath(resolve(readRequiredArgument(args, '--base-worktree')));
  const headWorktreePath = await realpath(resolve(readRequiredArgument(args, '--head-worktree')));
  const baseRef = readRequiredArgument(args, '--base-ref');
  const headRef = readRequiredArgument(args, '--head-ref');
  const baseApprovalFilePath = resolve(readRequiredArgument(args, '--base-approval-file'));
  const headApprovalFilePath = resolve(readRequiredArgument(args, '--head-approval-file'));
  const baseOutputDirectoryPath = resolve(readRequiredArgument(args, '--base-output-dir'));
  const headOutputDirectoryPath = resolve(readRequiredArgument(args, '--head-output-dir'));

  await Promise.all([
    assertPathOutsideWorktrees(
      baseApprovalFilePath,
      [baseWorktreePath, headWorktreePath],
      'Approval file',
    ),
    assertPathOutsideWorktrees(
      headApprovalFilePath,
      [baseWorktreePath, headWorktreePath],
      'Approval file',
    ),
    assertPathOutsideWorktrees(
      baseOutputDirectoryPath,
      [baseWorktreePath, headWorktreePath],
      'Output directory',
    ),
    assertPathOutsideWorktrees(
      headOutputDirectoryPath,
      [baseWorktreePath, headWorktreePath],
      'Output directory',
    ),
  ]);

  const [baseSnapshot, headSnapshot] = await Promise.all([
    getWorktreeSnapshot(baseWorktreePath),
    getWorktreeSnapshot(headWorktreePath),
  ]);
  await Promise.all([
    assertExpectedSnapshot(baseWorktreePath, baseSnapshot, baseRef, undefined, undefined),
    assertExpectedSnapshot(headWorktreePath, headSnapshot, headRef, undefined, undefined),
    assertApprovedSnapshot(baseWorktreePath, baseSnapshot, baseApprovalFilePath),
    assertApprovedSnapshot(headWorktreePath, headSnapshot, headApprovalFilePath),
  ]);
  if (baseSnapshot.headRef === headSnapshot.headRef) {
    throw new Error('Parity comparison requires base and head to resolve to different commits.');
  }
  assertSameInputIdentity(baseSnapshot, headSnapshot);

  const commonInputOptions = {
    expectedEnvSha256: baseSnapshot.envSha256,
    expectedDataSha256: baseSnapshot.dataSha256,
  };
  await runSingle({
    worktreePath: baseWorktreePath,
    expectedRef: baseRef,
    approvalFilePath: baseApprovalFilePath,
    ...commonInputOptions,
    outputDirectoryPath: baseOutputDirectoryPath,
  });
  await runSingle({
    worktreePath: headWorktreePath,
    expectedRef: headRef,
    approvalFilePath: headApprovalFilePath,
    ...commonInputOptions,
    outputDirectoryPath: headOutputDirectoryPath,
  });

  const [baseMetadata, headMetadata] = await Promise.all([
    readParityMetadata(baseOutputDirectoryPath),
    readParityMetadata(headOutputDirectoryPath),
  ]);
  assertMetadataMatchesSnapshot(baseMetadata, baseSnapshot, baseWorktreePath);
  assertMetadataMatchesSnapshot(headMetadata, headSnapshot, headWorktreePath);
  assertSameInputIdentity(baseMetadata, headMetadata);
  if (baseMetadata.makeId !== headMetadata.makeId) {
    throw new Error('Parity inputs differ: makeId definitions are not identical.');
  }

  await compareArtifacts(baseOutputDirectoryPath, headOutputDirectoryPath, SEED_ARTIFACT_NAME);
  await compareArtifacts(
    baseOutputDirectoryPath,
    headOutputDirectoryPath,
    NORMALIZED_ARTIFACT_NAME,
  );
  const [finalBaseSnapshot, finalHeadSnapshot] = await Promise.all([
    getWorktreeSnapshot(baseWorktreePath),
    getWorktreeSnapshot(headWorktreePath),
  ]);
  assertSnapshotUnchanged(baseSnapshot, finalBaseSnapshot, baseWorktreePath);
  assertSnapshotUnchanged(headSnapshot, finalHeadSnapshot, headWorktreePath);
  console.log('PARITY=PASS');
};

const readSingleRunOptions = (args: string[]): SingleRunOptions => ({
  worktreePath: resolve(readRequiredArgument(args, '--worktree')),
  expectedRef: readRequiredArgument(args, '--expected-ref'),
  expectedEnvSha256: readOptionalArgument(args, '--expected-env-sha256'),
  expectedDataSha256: readOptionalArgument(args, '--expected-data-sha256'),
  approvalFilePath: resolve(readRequiredArgument(args, '--approval-file')),
  outputDirectoryPath: resolve(readRequiredArgument(args, '--output-dir')),
});

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.includes('--create-approval')) {
    await createWorktreeApproval(args);
    return;
  }

  if (args.includes('--candidate-only')) {
    await runCandidate(readSingleRunOptions(args));
    return;
  }

  if (args.includes('--base-worktree') || args.includes('--head-worktree')) {
    await compareWorktrees(args);
    return;
  }

  await runSingle(readSingleRunOptions(args));
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Deposit preset parity harness failed.';
  console.error(message);
  process.exitCode = 1;
});
