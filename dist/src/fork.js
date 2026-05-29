import path from 'node:path';
import { createWorktree } from './git.js';
import { readManifest } from './io.js';
function safeBranch(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9/_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export async function forkRun(runId, options) {
    const run = await readManifest(runId);
    if (!run.git?.isRepo || !run.git.root || !run.git.head) {
        throw new Error('This run does not include a git repository snapshot to fork from.');
    }
    const frame = options.from
        ? run.frames.find((candidate) => candidate.index === options.from)
        : undefined;
    const suffix = frame ? `step-${frame.index}` : 'start';
    const branch = safeBranch(options.branch || `echo-blackbox/${run.id}/${suffix}`);
    const output = options.output ||
        path.join(path.dirname(run.git.root), `${path.basename(run.git.root)}-${branch.replace(/\//g, '-')}`);
    const summary = [
        `Run: ${run.id}`,
        `Fork branch: ${branch}`,
        `Worktree: ${output}`,
        `Base ref: ${run.git.head}`,
        frame ? `Frame: [${frame.index}] ${frame.title}` : 'Frame: initial git snapshot',
        options.note ? `Correction note: ${options.note}` : undefined,
    ]
        .filter(Boolean)
        .join('\n');
    if (options.dryRun)
        return `${summary}\nDry run: no worktree created.\n`;
    await createWorktree({
        gitRoot: run.git.root,
        branch,
        output,
        baseRef: run.git.head,
    });
    return `${summary}\nCreated worktree.\n`;
}
