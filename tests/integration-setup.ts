import { resolve } from 'path';

import './setup';
import { loadEnvironmentFile } from './setup';

loadEnvironmentFile(resolve(process.cwd(), '.env.integration.local'));

if (!process.env.INTEGRATION_DATABASE_URL) {
  throw new Error(
    'INTEGRATION_DATABASE_URL is required to run database integration tests.',
  );
}
