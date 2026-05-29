import { formatMarkdown } from './format.js';
import { readManifest } from './io.js';
import { redactValue } from './redact.js';
import type { ExportFormat } from './types.js';

export async function exportRun(
  runId: string,
  format: ExportFormat,
  options: { redact?: boolean } = {}
): Promise<string> {
  const run = await readManifest(runId);
  const exportableRun = options.redact ? redactValue(run) : run;
  if (format === 'json') return `${JSON.stringify(exportableRun, null, 2)}\n`;
  return `${formatMarkdown(exportableRun as typeof run)}\n`;
}
