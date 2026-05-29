import fs from 'node:fs/promises';
import path from 'node:path';
import { getBlackBoxPaths, getManifestPath, getRunDir } from './paths.js';
import type { RunFrame, RunManifest } from './types.js';

const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export function validateRunId(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error('Run id must contain only letters, numbers, dots, underscores, or hyphens.');
  }
  return runId;
}

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(getBlackBoxPaths().runsDir, { recursive: true });
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value);
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readManifest(runId: string): Promise<RunManifest> {
  const raw = await fs.readFile(getManifestPath(validateRunId(runId)), 'utf8');
  return JSON.parse(raw) as RunManifest;
}

export async function writeManifest(manifest: RunManifest): Promise<void> {
  await writeJson(getManifestPath(manifest.id), manifest);
}

export async function appendFrameJsonl(
  runId: string,
  frame: RunFrame
): Promise<void> {
  await fs.mkdir(getRunDir(runId), { recursive: true });
  await fs.appendFile(
    path.join(getRunDir(runId), 'frames.jsonl'),
    `${JSON.stringify({ type: 'frame', ...frame })}\n`
  );
}

export async function listRunIds(): Promise<string[]> {
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

export async function listRuns(): Promise<RunManifest[]> {
  const manifests: RunManifest[] = [];
  for (const runId of await listRunIds()) {
    try {
      manifests.push(await readManifest(runId));
    } catch {
      // Ignore incomplete run directories. A crashed recorder can leave one.
    }
  }
  return manifests.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function resolveRunId(value?: string): Promise<string> {
  if (value && value !== 'latest') return validateRunId(value);
  const [latest] = await listRuns();
  if (!latest) throw new Error('No Echo Black Box runs found.');
  return latest.id;
}

export async function runExists(runId: string): Promise<boolean> {
  try {
    await fs.stat(getRunDir(runId));
    return true;
  } catch {
    return false;
  }
}
