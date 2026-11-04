import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const testEnvFilePath = resolve(process.cwd(), '.env.test');

/**
 * Loads environment variables from a dotenv-style file.
 *
 * @param filePath Path to the environment file.
 * @returns Nothing. Parsed values are assigned to `process.env`.
 * @throws {Error} When the environment file cannot be read.
 */
export const loadEnvironmentFile = (filePath: string): void => {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
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
    process.env[key] = value;
  }
};

loadEnvironmentFile(testEnvFilePath);
