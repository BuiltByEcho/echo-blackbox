import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const cli = path.resolve('dist/src/cli.js');

async function runCli(args, options = {}) {
  return execFileAsync(process.execPath, [cli, ...args], {
    env: {
      ...process.env,
      ECHO_BLACKBOX_HOME: options.home,
    },
    cwd: options.cwd || process.cwd(),
    maxBuffer: 1024 * 1024 * 5,
  });
}

test('record creates a run with manifest, frames, and output artifacts', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'echo-blackbox-test-'));

  const result = await runCli(
    ['record', '--name', 'unit', '--', 'node', '-e', "console.log('ok')"],
    { home }
  );

  assert.match(result.stderr, /Recorded Echo Black Box run:/);
  const runsDir = path.join(home, 'runs');
  const [runId] = await fs.readdir(runsDir);
  assert.ok(runId);

  const runDir = path.join(runsDir, runId);
  const manifest = JSON.parse(
    await fs.readFile(path.join(runDir, 'manifest.json'), 'utf8')
  );
  const stdout = await fs.readFile(path.join(runDir, 'stdout.log'), 'utf8');
  const frames = await fs.readFile(path.join(runDir, 'frames.jsonl'), 'utf8');

  assert.equal(manifest.name, 'unit');
  assert.equal(manifest.status, 'success');
  assert.equal(manifest.exitCode, 0);
  assert.match(stdout, /ok/);
  assert.match(frames, /"kind":"session"/);
  assert.match(frames, /"kind":"exit"/);
});

test('runs, show, export, and fork dry-run operate on latest run', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'echo-blackbox-test-'));
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'echo-blackbox-repo-'));
  await fs.writeFile(path.join(repo, 'README.md'), '# fixture\n');
  await execFileAsync('git', ['init'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.name', 'Echo Test'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.email', 'echo@example.test'], { cwd: repo });
  await execFileAsync('git', ['add', 'README.md'], { cwd: repo });
  await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: repo });

  await runCli(
    ['record', '--name', 'flow', '-C', repo, '--', 'node', '-e', "console.error('warn')"],
    { home }
  );

  const runs = await runCli(['runs'], { home });
  assert.match(runs.stdout, /flow/);
  assert.match(runs.stdout, /success/);

  const show = await runCli(['show', 'latest'], { home });
  assert.match(show.stdout, /Echo Black Box Run: flow/);
  assert.match(show.stdout, /Timeline:/);

  const exported = await runCli(['export', 'latest', '--format', 'json'], { home });
  const parsed = JSON.parse(exported.stdout);
  assert.equal(parsed.name, 'flow');
  assert.ok(Array.isArray(parsed.frames));

  const fork = await runCli(['fork', 'latest', '--from', '1', '--note', 'try again'], {
    home,
  });
  assert.match(fork.stdout, /Dry run: no worktree created/);
  assert.match(fork.stdout, /try again/);
});
