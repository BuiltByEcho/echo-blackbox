import fs from 'node:fs/promises';
import path from 'node:path';
import { getBlackBoxPaths, getManifestPath, getRunDir } from './paths.js';
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
export function validateRunId(runId) {
    if (!RUN_ID_PATTERN.test(runId)) {
        throw new Error('Run id must contain only letters, numbers, dots, underscores, or hyphens.');
    }
    return runId;
}
export async function ensureStorage() {
    await fs.mkdir(getBlackBoxPaths().runsDir, { recursive: true });
}
export async function writeText(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, value);
}
export async function writeJson(filePath, value) {
    await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
export async function readManifest(runId) {
    const raw = await fs.readFile(getManifestPath(validateRunId(runId)), 'utf8');
    return JSON.parse(raw);
}
export async function writeManifest(manifest) {
    await writeJson(getManifestPath(manifest.id), manifest);
}
export async function appendFrameJsonl(runId, frame) {
    await fs.mkdir(getRunDir(runId), { recursive: true });
    await fs.appendFile(path.join(getRunDir(runId), 'frames.jsonl'), `${JSON.stringify({ type: 'frame', ...frame })}\n`);
}
export async function listRunIds() {
    await ensureStorage();
    const entries = await fs.readdir(getBlackBoxPaths().runsDir, {
        withFileTypes: true,
    });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();
}
export async function listRuns() {
    const manifests = [];
    for (const runId of await listRunIds()) {
        try {
            manifests.push(await readManifest(runId));
        }
        catch {
            // Ignore incomplete run directories. A crashed recorder can leave one.
        }
    }
    return manifests.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export async function resolveRunId(value) {
    if (value && value !== 'latest')
        return validateRunId(value);
    const [latest] = await listRuns();
    if (!latest)
        throw new Error('No Echo Black Box runs found.');
    return latest.id;
}
export async function runExists(runId) {
    try {
        await fs.stat(getRunDir(runId));
        return true;
    }
    catch {
        return false;
    }
}
