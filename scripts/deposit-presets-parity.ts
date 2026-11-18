import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = null | boolean | number | string | JsonObject | JsonValue[];

type PresetModule = typeof import('../src/deposit/presets');
type EnvironmentModule = typeof import('../src/core/env');

const FIXED_MAKE_ID = (prefix: string): string => `${prefix}fixed-id`;
const SEED_ARTIFACT_NAME = 'seed-store.json';
const NORMALIZED_ARTIFACT_NAME = 'normalized-store.json';

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

const writeArtifact = async (filePath: string, value: JsonValue): Promise<string> => {
  const content = formatCanonicalJson(value);
  await writeFile(filePath, content, 'utf8');
  return createHash('sha256').update(content).digest('hex');
};

const readRequiredArgument = (args: string[], name: string): string => {
  const argumentIndex = args.indexOf(name);
  const value = args[argumentIndex + 1];
  if (argumentIndex === -1 || !value) {
    throw new Error(`Usage: bun run scripts/deposit-presets-parity.ts ${name} <path> ...`);
  }

  return value;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const worktreePath = resolve(readRequiredArgument(args, '--worktree'));
  const outputDirectoryPath = resolve(readRequiredArgument(args, '--output-dir'));
  const envFilePath = join(worktreePath, '.env.test');
  const dataDirectoryPath = join(worktreePath, 'data', 'deposit');

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

  await mkdir(outputDirectoryPath, { recursive: true });
  const seedArtifactPath = join(outputDirectoryPath, SEED_ARTIFACT_NAME);
  const normalizedArtifactPath = join(outputDirectoryPath, NORMALIZED_ARTIFACT_NAME);
  const [seedChecksum, normalizedChecksum] = await Promise.all([
    writeArtifact(seedArtifactPath, seedStore as unknown as JsonValue),
    writeArtifact(normalizedArtifactPath, normalizedStore as unknown as JsonValue),
  ]);

  const envChecksum = createHash('sha256')
    .update(await readFile(envFilePath))
    .digest('hex');
  const dataChecksum = await hashFiles(dataDirectoryPath);
  const artifactStats = await Promise.all([
    stat(seedArtifactPath),
    stat(normalizedArtifactPath),
  ]);

  console.log(`WORKTREE=${worktreePath}`);
  console.log(`ENV_SOURCE=${envFilePath}`);
  console.log(`ENV_SHA256=${envChecksum}`);
  console.log(`DATA_SOURCE=${dataDirectoryPath}`);
  console.log(`DATA_SHA256=${dataChecksum}`);
  console.log(`MAKE_ID=(prefix: string) => \`${'${prefix}'}fixed-id\``);
  console.log(`SEED_ARTIFACT=${seedArtifactPath}`);
  console.log(`SEED_BYTES=${artifactStats[0]?.size ?? 0}`);
  console.log(`SEED_SHA256=${seedChecksum}`);
  console.log(`NORMALIZED_ARTIFACT=${normalizedArtifactPath}`);
  console.log(`NORMALIZED_BYTES=${artifactStats[1]?.size ?? 0}`);
  console.log(`NORMALIZED_SHA256=${normalizedChecksum}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Deposit preset parity harness failed.';
  console.error(message);
  process.exitCode = 1;
});
