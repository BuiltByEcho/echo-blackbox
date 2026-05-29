import os from 'node:os';
import path from 'node:path';
import type { BlackBoxPaths } from './types.js';

export function getBlackBoxPaths(): BlackBoxPaths {
  const home =
    process.env.ECHO_BLACKBOX_HOME ||
    path.join(os.homedir(), '.config', 'echo-blackbox');

  return {
    home,
    runsDir: path.join(home, 'runs'),
  };
}

export function getRunDir(runId: string): string {
  return path.join(getBlackBoxPaths().runsDir, runId);
}

export function getManifestPath(runId: string): string {
  return path.join(getRunDir(runId), 'manifest.json');
}
