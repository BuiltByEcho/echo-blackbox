import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function run(file, args, options = {}) {
  return execFileAsync(file, args, {
    cwd: options.cwd || repoRoot,
    env: {
      ...process.env,
      ...options.env,
    },
    maxBuffer: 1024 * 1024 * 10,
  });
}

test('packed tarball installs and runs the release smoke flow', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'echo-blackbox-package-smoke-'));
  t.after(() => fs.rm(tempRoot, { recursive: true, force: true }));

  await run('npm', ['pack', '--pack-destination', tempRoot]);
  const tarballs = (await fs.readdir(tempRoot)).filter((entry) => entry.endsWith('.tgz'));
  assert.equal(tarballs.length, 1);

  const tarball = path.join(tempRoot, tarballs[0]);
  const prefix = path.join(tempRoot, 'prefix');
  await run('npm', ['install', '--prefix', prefix, tarball]);

  const bin = path.join(prefix, 'node_modules', '.bin', 'echo-blackbox');
  const help = await run(bin, ['--help']);
  assert.match(help.stdout, /Terminal flight recorder/);

  const gitRoot = path.join(tempRoot, 'git-fixture');
  await fs.mkdir(gitRoot);
  await run('git', ['init'], { cwd: gitRoot });
  await run('git', ['config', 'user.name', 'Echo Test'], { cwd: gitRoot });
  await run('git', ['config', 'user.email', 'echo-test@example.com'], {
    cwd: gitRoot,
  });
  await fs.writeFile(path.join(gitRoot, 'README.md'), '# fixture\n');
  await run('git', ['add', 'README.md'], { cwd: gitRoot });
  await run('git', ['commit', '-m', 'fixture'], { cwd: gitRoot });

  const home = path.join(tempRoot, 'blackbox-home');
  await run(
    bin,
    [
      'record',
      '--name',
      'package-smoke',
      '-C',
      gitRoot,
      '--',
      process.execPath,
      '-e',
      'console.log("token=secret-token-123456789")',
    ],
    { env: { ECHO_BLACKBOX_HOME: home } }
  );

  const json = await run(bin, ['export', 'latest', '--format', 'json', '--redact'], {
    env: { ECHO_BLACKBOX_HOME: home },
  });
  assert.doesNotMatch(json.stdout, /secret-token-123456789/);
  assert.match(json.stdout, /\[REDACTED\]/);

  const fork = await run(bin, ['fork', 'latest', '--from', '1'], {
    env: { ECHO_BLACKBOX_HOME: home },
  });
  assert.match(fork.stdout, /Dry run: no worktree created/);
  assert.match(fork.stdout, /Base ref:/);
});
