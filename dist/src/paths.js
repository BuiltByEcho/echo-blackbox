import os from 'node:os';
import path from 'node:path';
export function getBlackBoxPaths() {
    const home = process.env.ECHO_BLACKBOX_HOME ||
        path.join(os.homedir(), '.config', 'echo-blackbox');
    return {
        home,
        runsDir: path.join(home, 'runs'),
    };
}
export function getRunDir(runId) {
    return path.join(getBlackBoxPaths().runsDir, runId);
}
export function getManifestPath(runId) {
    return path.join(getRunDir(runId), 'manifest.json');
}
