import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { nanoid } from 'nanoid';
import { captureGitSnapshot } from './git.js';
import { appendFrameJsonl, ensureStorage, writeManifest, writeText } from './io.js';
import { getRunDir } from './paths.js';
function now() {
    return new Date().toISOString();
}
function safeName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);
}
async function addFrame(runId, frames, kind, title, summary, data) {
    const frame = {
        id: nanoid(10),
        index: frames.length + 1,
        kind,
        title,
        timestamp: now(),
    };
    if (summary)
        frame.summary = summary;
    if (data)
        frame.data = data;
    frames.push(frame);
    if (runId)
        await appendFrameJsonl(runId, frame);
    return frame;
}
async function writeDiffIfPresent(runDir, name, diff) {
    if (!diff)
        return undefined;
    const filePath = path.join(runDir, name);
    await writeText(filePath, diff);
    return name;
}
export async function recordCommand(command, options) {
    if (command.length === 0) {
        throw new Error('Missing command after "--". Example: echo-blackbox record -- npm test');
    }
    await ensureStorage();
    const startedAt = now();
    const baseName = options.name || command[0] || 'run';
    const runId = `${startedAt.replace(/[:.]/g, '-')}-${safeName(baseName)}-${nanoid(6)}`;
    const runDir = getRunDir(runId);
    await fs.mkdir(runDir, { recursive: true });
    const frames = [];
    await addFrame(runId, frames, 'session', 'Run started', command.join(' '), {
        command,
        cwd: options.cwd,
    });
    for (const checkpoint of options.checkpoint || []) {
        await addFrame(runId, frames, 'checkpoint', checkpoint);
    }
    const before = await captureGitSnapshot(options.cwd);
    const diffBeforePath = await writeDiffIfPresent(runDir, 'diff-before.patch', before.diff);
    if (before.isRepo) {
        await addFrame(runId, frames, 'git', 'Git snapshot before run', before.branch, {
            root: before.root,
            branch: before.branch,
            head: before.head,
            dirty: before.dirty,
            diffPath: diffBeforePath,
        });
    }
    const manifest = {
        id: runId,
        name: options.name || command.join(' '),
        command,
        cwd: options.cwd,
        status: 'running',
        startedAt,
        storageVersion: 1,
        git: {
            isRepo: before.isRepo,
            root: before.root,
            branch: before.branch,
            head: before.head,
            dirtyBefore: before.dirty,
            diffBeforePath,
        },
        frames,
    };
    await writeManifest(manifest);
    const stdoutPath = path.join(runDir, 'stdout.log');
    const stderrPath = path.join(runDir, 'stderr.log');
    const stdoutHandle = await fs.open(stdoutPath, 'a');
    const stderrHandle = await fs.open(stderrPath, 'a');
    const pendingWrites = [];
    try {
        const child = spawn(command[0], command.slice(1), {
            cwd: options.cwd,
            env: process.env,
            stdio: ['inherit', 'pipe', 'pipe'],
        });
        child.stdout?.on('data', (chunk) => {
            pendingWrites.push(stdoutHandle.write(chunk).then(() => undefined));
            if (options.passthrough)
                process.stdout.write(chunk);
        });
        child.stderr?.on('data', (chunk) => {
            pendingWrites.push(stderrHandle.write(chunk).then(() => undefined));
            if (options.passthrough)
                process.stderr.write(chunk);
        });
        let spawnError;
        const exitCode = await new Promise((resolve) => {
            child.on('error', (error) => {
                spawnError = error;
                resolve(null);
            });
            child.on('close', (code) => resolve(code));
        });
        await Promise.all(pendingWrites);
        await addFrame(runId, frames, 'stdout', 'Captured stdout', 'stdout.log');
        await addFrame(runId, frames, 'stderr', 'Captured stderr', 'stderr.log');
        const after = await captureGitSnapshot(options.cwd);
        const diffAfterPath = await writeDiffIfPresent(runDir, 'diff-after.patch', after.diff);
        if (after.isRepo) {
            await addFrame(runId, frames, 'git', 'Git snapshot after run', after.branch, {
                root: after.root,
                branch: after.branch,
                head: after.head,
                dirty: after.dirty,
                diffPath: diffAfterPath,
            });
        }
        await addFrame(runId, frames, spawnError ? 'note' : 'exit', spawnError ? 'Command failed to start' : exitCode === 0 ? 'Run completed' : 'Run failed', spawnError ? spawnError.message : `exit code ${exitCode ?? 'unknown'}`, spawnError ? { error: spawnError.message } : { exitCode });
        manifest.status = !spawnError && exitCode === 0 ? 'success' : 'failed';
        manifest.exitCode = exitCode;
        manifest.finishedAt = now();
        manifest.git = {
            ...manifest.git,
            isRepo: after.isRepo,
            root: after.root || manifest.git?.root,
            branch: after.branch || manifest.git?.branch,
            head: after.head || manifest.git?.head,
            dirtyBefore: before.dirty,
            dirtyAfter: after.dirty,
            diffBeforePath,
            diffAfterPath,
        };
        await writeManifest(manifest);
        if (spawnError)
            throw spawnError;
        return manifest;
    }
    finally {
        await Promise.allSettled(pendingWrites);
        await stdoutHandle.close();
        await stderrHandle.close();
    }
}
