import { formatMarkdown } from './format.js';
import { readManifest } from './io.js';
import { redactValue } from './redact.js';
export async function exportRun(runId, format, options = {}) {
    const run = await readManifest(runId);
    const exportableRun = options.redact ? redactValue(run) : run;
    if (format === 'json')
        return `${JSON.stringify(exportableRun, null, 2)}\n`;
    return `${formatMarkdown(exportableRun)}\n`;
}
