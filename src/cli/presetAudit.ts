import { resolve } from 'path';
import { auditPresetData } from '../core/presetAudit';

/**
 * Runs the preset source audit and prints its JSON report.
 *
 * @param dataDirPath Directory containing the deposit, payout, and subscription preset data.
 * @returns The generated audit report.
 * @throws {TypeError} When the audit data directory is empty.
 */
export const runPresetAudit = async (dataDirPath = resolve(process.cwd(), 'data')) => {
  const report = await auditPresetData({ dataDirPath });
  console.log(JSON.stringify(report, null, 2));

  if (report.summary.invalid > 0) {
    process.exitCode = 1;
  }

  return report;
};

if (import.meta.main) {
  await runPresetAudit();
}
