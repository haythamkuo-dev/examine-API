import { afterEach, describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { chmod, lstat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const projectRootPath = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const harnessPath = resolve(dirname(fileURLToPath(import.meta.url)), 'deposit-presets-parity.ts');
const temporaryDirectories: string[] = [];
const BAD_CHECKSUM = '0'.repeat(64);

type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const createTemporaryDirectory = async (prefix: string): Promise<string> => {
  const directoryPath = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directoryPath);
  return directoryPath;
};

const runCommand = async (file: string, args: string[]): Promise<CommandResult> => {
  try {
    const result = await execFile(file, args, {
      cwd: projectRootPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    if (!isRecord(error)) {
      return { exitCode: 1, stdout: '', stderr: String(error) };
    }

    return {
      exitCode: typeof error.code === 'number' ? error.code : 1,
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
      stderr: typeof error.stderr === 'string' ? error.stderr : String(error.message ?? error),
    };
  }
};

const createRepositoryClone = async (): Promise<string> => {
  const parentDirectoryPath = await createTemporaryDirectory('deposit-presets-parity-clone-');
  const repositoryPath = join(parentDirectoryPath, 'repo');
  const result = await runCommand('git', [
    'clone',
    '--quiet',
    '--no-local',
    projectRootPath,
    repositoryPath,
  ]);
  expect(result.exitCode).toBe(0);
  return repositoryPath;
};

const getHeadRef = async (repositoryPath: string): Promise<string> => {
  const result = await execFile('git', ['-C', repositoryPath, 'rev-parse', '--verify', 'HEAD'], {
    cwd: projectRootPath,
    encoding: 'utf8',
  });
  return result.stdout.trim();
};

const createEmptyCommit = async (repositoryPath: string): Promise<void> => {
  const result = await runCommand('git', [
    '-c',
    'user.name=Deposit Parity Test',
    '-c',
    'user.email=deposit-parity-test@example.invalid',
    '-C',
    repositoryPath,
    'commit',
    '--quiet',
    '--allow-empty',
    '--message',
    'create distinct parity test commit',
  ]);
  expect(result.exitCode).toBe(0);
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const runHarness = (args: string[]): Promise<CommandResult> =>
  runCommand(process.execPath, [harnessPath, ...args]);

const createApprovalFile = async (repositoryPath: string, headRef: string): Promise<string> => {
  const approvalParentPath = await createTemporaryDirectory('deposit-presets-parity-approval-');
  const approvalFilePath = join(approvalParentPath, 'approval.json');
  const result = await runHarness([
    '--create-approval',
    '--worktree',
    repositoryPath,
    '--expected-ref',
    headRef,
    '--approval-file',
    approvalFilePath,
  ]);
  expect(result.exitCode).toBe(0);
  return approvalFilePath;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) =>
      rm(directoryPath, { recursive: true, force: true }),
    ),
  );
});

describe('deposit preset parity harness', () => {
  test('rejects a dirty worktree before candidate module loading', async () => {
    expect.hasAssertions();
    const repositoryPath = await createRepositoryClone();
    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const headRef = await getHeadRef(repositoryPath);
    const approvalFilePath = await createApprovalFile(repositoryPath, headRef);
    await writeFile(join(repositoryPath, 'untracked-parity-input'), 'fixture\n', 'utf8');

    const result = await runHarness([
      '--worktree',
      repositoryPath,
      '--expected-ref',
      headRef,
      '--approval-file',
      approvalFilePath,
      '--output-dir',
      join(outputParentPath, 'out'),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Worktree must be clean');
    expect(await pathExists(join(outputParentPath, 'out'))).toBe(false);
  });

  test('rejects a worktree without an external approval manifest', async () => {
    expect.hasAssertions();
    const repositoryPath = await createRepositoryClone();
    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const headRef = await getHeadRef(repositoryPath);

    const result = await runHarness([
      '--worktree',
      repositoryPath,
      '--expected-ref',
      headRef,
      '--output-dir',
      join(outputParentPath, 'out'),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('--approval-file');
    expect(await pathExists(join(outputParentPath, 'out'))).toBe(false);
  });

  test('rejects output inside the candidate worktree', async () => {
    expect.hasAssertions();
    const repositoryPath = await createRepositoryClone();
    const headRef = await getHeadRef(repositoryPath);
    const approvalFilePath = await createApprovalFile(repositoryPath, headRef);
    const outputDirectoryPath = join(repositoryPath, 'parity-output');

    const result = await runHarness([
      '--worktree',
      repositoryPath,
      '--expected-ref',
      headRef,
      '--approval-file',
      approvalFilePath,
      '--output-dir',
      outputDirectoryPath,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Output directory must be outside the worktree',
    );
    expect(await pathExists(outputDirectoryPath)).toBe(false);
  });

  test('rejects an input checksum that is not the approved parity input', async () => {
    expect.hasAssertions();
    const repositoryPath = await createRepositoryClone();
    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const headRef = await getHeadRef(repositoryPath);
    const approvalFilePath = await createApprovalFile(repositoryPath, headRef);

    const result = await runHarness([
      '--worktree',
      repositoryPath,
      '--expected-ref',
      headRef,
      '--approval-file',
      approvalFilePath,
      '--expected-env-sha256',
      BAD_CHECKSUM,
      '--expected-data-sha256',
      BAD_CHECKSUM,
      '--output-dir',
      join(outputParentPath, 'out'),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Worktree .env.test checksum does not match the expected input',
    );
    expect(await pathExists(join(outputParentPath, 'out'))).toBe(false);
  });

  test('does not execute a worktree fsmonitor hook during snapshot validation', async () => {
    expect.hasAssertions();
    const repositoryPath = await createRepositoryClone();
    const hookParentPath = await createTemporaryDirectory('deposit-presets-parity-hook-');
    const hookPath = join(hookParentPath, 'fsmonitor-hook.sh');
    const markerPath = `${hookPath}.invoked`;
    await writeFile(
      hookPath,
      '#!/bin/sh\nprintf \'invoked\\n\' >> "$0.invoked"\n',
      'utf8',
    );
    await chmod(hookPath, 0o755);
    const configResult = await runCommand('git', [
      '-C',
      repositoryPath,
      'config',
      'core.fsmonitor',
      hookPath,
    ]);
    expect(configResult.exitCode).toBe(0);

    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const headRef = await getHeadRef(repositoryPath);
    const approvalFilePath = await createApprovalFile(repositoryPath, headRef);
    const result = await runHarness([
      '--worktree',
      repositoryPath,
      '--expected-ref',
      headRef,
      '--approval-file',
      approvalFilePath,
      '--output-dir',
      join(outputParentPath, 'out'),
    ]);

    expect(result.exitCode).toBe(0);
    expect(await pathExists(markerPath)).toBe(false);
  });

  test('rejects a compare when base and head resolve to the same commit', async () => {
    expect.hasAssertions();
    const baseRepositoryPath = await createRepositoryClone();
    const headRepositoryPath = await createRepositoryClone();
    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const baseRef = await getHeadRef(baseRepositoryPath);
    const headRef = await getHeadRef(headRepositoryPath);
    const baseApprovalFilePath = await createApprovalFile(baseRepositoryPath, baseRef);
    const headApprovalFilePath = await createApprovalFile(headRepositoryPath, headRef);
    expect(baseRef).toBe(headRef);

    const result = await runHarness([
      '--base-worktree',
      baseRepositoryPath,
      '--base-ref',
      baseRef,
      '--base-approval-file',
      baseApprovalFilePath,
      '--head-worktree',
      headRepositoryPath,
      '--head-ref',
      headRef,
      '--head-approval-file',
      headApprovalFilePath,
      '--base-output-dir',
      join(outputParentPath, 'base'),
      '--head-output-dir',
      join(outputParentPath, 'head'),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'requires base and head to resolve to different commits',
    );
    expect(await pathExists(join(outputParentPath, 'base'))).toBe(false);
    expect(await pathExists(join(outputParentPath, 'head'))).toBe(false);
  });

  test('compares two clean worktrees and publishes parity metadata', async () => {
    expect.hasAssertions();
    const baseRepositoryPath = await createRepositoryClone();
    const headRepositoryPath = await createRepositoryClone();
    const outputParentPath = await createTemporaryDirectory('deposit-presets-parity-output-');
    const baseRef = await getHeadRef(baseRepositoryPath);
    await createEmptyCommit(headRepositoryPath);
    const headRef = await getHeadRef(headRepositoryPath);
    const baseApprovalFilePath = await createApprovalFile(baseRepositoryPath, baseRef);
    const headApprovalFilePath = await createApprovalFile(headRepositoryPath, headRef);
    expect(baseRef).not.toBe(headRef);

    const result = await runHarness([
      '--base-worktree',
      baseRepositoryPath,
      '--base-ref',
      baseRef,
      '--base-approval-file',
      baseApprovalFilePath,
      '--head-worktree',
      headRepositoryPath,
      '--head-ref',
      headRef,
      '--head-approval-file',
      headApprovalFilePath,
      '--base-output-dir',
      join(outputParentPath, 'base'),
      '--head-output-dir',
      join(outputParentPath, 'head'),
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PARITY=PASS');
    expect(await pathExists(join(outputParentPath, 'base', 'parity-metadata.json'))).toBe(true);
    expect(await pathExists(join(outputParentPath, 'head', 'parity-metadata.json'))).toBe(true);
  });
});
