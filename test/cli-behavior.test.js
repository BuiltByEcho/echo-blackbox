import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const cliPath = path.join(repoRoot, 'dist', 'src', 'cli.js');

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeTempDir(name) {
  return fs.mkdtemp(path.join(os.tmpdir(), `echo-blackbox-${name}-`));
}

async function runCli(args, options) {
  if (!(await pathExists(cliPath))) {
    options.test.skip('dist/src/cli.js is not present yet');
    return { stdout: '', stderr: '', code: 0 };
  }

  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: options.cwd || repoRoot,
      env: {
        ...process.env,
        ECHO_BLACKBOX_HOME: options.home,
      },
      maxBuffer: 1024 * 1024 * 10,
    });
    return { ...result, code: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      code: error.code ?? 1,
    };
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function listManifestFiles(home) {
  const runsDir = path.join(home, 'runs');
  const runIds = await fs.readdir(runsDir);
  return runIds.map((runId) => path.join(runsDir, runId, 'manifest.json'));
}

async function seedRun(home, manifest) {
  const runDir = path.join(home, 'runs', manifest.id);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(
    path.join(runDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

function makeManifest(overrides = {}) {
  return {
    id: '2026-05-29T12-00-00-000Z-cli-test',
    name: 'cli seeded run',
    command: ['node', '-e', 'console.log("seed")'],
    cwd: repoRoot,
    status: 'success',
    startedAt: '2026-05-29T12:00:00.000Z',
    finishedAt: '2026-05-29T12:00:01.000Z',
    exitCode: 0,
    storageVersion: 1,
    git: { isRepo: false },
    frames: [
      {
        id: 'frame-session',
        index: 1,
        kind: 'session',
        title: 'Run started',
        timestamp: '2026-05-29T12:00:00.000Z',
        summary: 'node -e console.log("seed")',
      },
      {
        id: 'frame-checkpoint',
        index: 2,
        kind: 'checkpoint',
        title: 'Before assertion',
        timestamp: '2026-05-29T12:00:00.500Z',
      },
      {
        id: 'frame-exit',
        index: 3,
        kind: 'exit',
        title: 'Run completed',
        timestamp: '2026-05-29T12:00:01.000Z',
        summary: 'exit code 0',
        data: { exitCode: 0 },
      },
    ],
    ...overrides,
  };
}

describe('echo-blackbox CLI behavior', () => {
  it('record creates a run with frames, logs, and metadata', async (t) => {
    const home = await makeTempDir('record');
    const cwd = await makeTempDir('cwd');
    const script =
      'console.log("blackbox stdout"); console.error("blackbox stderr");';

    const result = await runCli(
      [
        'record',
        '--name',
        'cli-smoke',
        '--checkpoint',
        'Before command',
        '--',
        process.execPath,
        '-e',
        script,
      ],
      { home, cwd, test: t }
    );

    assert.equal(result.code, 0, result.stderr || result.stdout);

    const [manifestPath] = await listManifestFiles(home);
    assert.ok(manifestPath, 'expected one recorded manifest');
    const manifest = await readJson(manifestPath);
    const runDir = path.dirname(manifestPath);

    assert.equal(manifest.name, 'cli-smoke');
    assert.deepEqual(manifest.command, [process.execPath, '-e', script]);
    assert.equal(await fs.realpath(manifest.cwd), await fs.realpath(cwd));
    assert.equal(manifest.status, 'success');
    assert.equal(manifest.exitCode, 0);
    assert.equal(manifest.storageVersion, 1);
    assert.ok(manifest.startedAt);
    assert.ok(manifest.finishedAt);

    const kinds = manifest.frames.map((frame) => frame.kind);
    assert.ok(kinds.includes('session'));
    assert.ok(kinds.includes('checkpoint'));
    assert.ok(kinds.includes('stdout'));
    assert.ok(kinds.includes('stderr'));
    assert.ok(kinds.includes('exit'));

    assert.match(
      await fs.readFile(path.join(runDir, 'stdout.log'), 'utf8'),
      /blackbox stdout/
    );
    assert.match(
      await fs.readFile(path.join(runDir, 'stderr.log'), 'utf8'),
      /blackbox stderr/
    );
  });

  it('record persists failed runs when the command exits non-zero', async (t) => {
    const home = await makeTempDir('record-failed');

    const result = await runCli(
      ['record', '--name', 'expected-failure', '--', process.execPath, '-e', 'process.exit(7)'],
      { home, test: t }
    );

    assert.equal(result.code, 7);

    const [manifestPath] = await listManifestFiles(home);
    assert.ok(manifestPath, 'expected one recorded manifest');
    const manifest = await readJson(manifestPath);

    assert.equal(manifest.status, 'failed');
    assert.equal(manifest.exitCode, 7);
    assert.ok(manifest.finishedAt);
    assert.equal(manifest.frames.at(-1).kind, 'exit');
    assert.match(manifest.frames.at(-1).summary, /exit code 7/);
  });

  it('record marks a run failed when the command cannot start', async (t) => {
    const home = await makeTempDir('record-spawn-error');

    const result = await runCli(
      ['record', '--name', 'missing-command', '--', 'echo-blackbox-command-that-does-not-exist'],
      { home, test: t }
    );

    assert.equal(result.code, 1);
    assert.match(result.stderr, /echo-blackbox:/);

    const [manifestPath] = await listManifestFiles(home);
    assert.ok(manifestPath, 'expected one recorded manifest');
    const manifest = await readJson(manifestPath);

    assert.equal(manifest.status, 'failed');
    assert.equal(manifest.exitCode, null);
    assert.ok(manifest.finishedAt);
    assert.equal(manifest.frames.at(-1).kind, 'note');
    assert.match(manifest.frames.at(-1).title, /failed to start/i);
  });

  it('runs lists runs and show displays the timeline', async (t) => {
    const home = await makeTempDir('show');
    const manifest = makeManifest();
    await seedRun(home, manifest);

    const runs = await runCli(['runs'], { home, test: t });
    assert.equal(runs.code, 0, runs.stderr || runs.stdout);
    assert.match(runs.stdout, new RegExp(manifest.id));
    assert.match(runs.stdout, /cli seeded run/);
    assert.match(runs.stdout, /success/);

    const show = await runCli(['show', manifest.id], { home, test: t });
    assert.equal(show.code, 0, show.stderr || show.stdout);
    assert.match(show.stdout, /Echo Black Box Run: cli seeded run/);
    assert.match(show.stdout, /Timeline:/);
    assert.match(show.stdout, /\[1\] SESSION Run started/);
    assert.match(show.stdout, /\[2\] CHECKPOINT Before assertion/);
  });

  it('latest skips incomplete run directories', async (t) => {
    const home = await makeTempDir('latest');
    const manifest = makeManifest({
      id: '2026-05-29T12-00-00-000Z-good-run',
    });
    await seedRun(home, manifest);
    await fs.mkdir(
      path.join(home, 'runs', '9999-12-31T23-59-59-999Z-incomplete-run'),
      { recursive: true }
    );

    const show = await runCli(['show', 'latest'], { home, test: t });

    assert.equal(show.code, 0, show.stderr || show.stdout);
    assert.match(show.stdout, /2026-05-29T12-00-00-000Z-good-run/);
  });

  it('rejects path-like run ids', async (t) => {
    const home = await makeTempDir('path-like-run-id');
    const result = await runCli(['show', '../outside'], { home, test: t });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Run id must contain only/);
  });

  it('export emits JSON and markdown representations', async (t) => {
    const home = await makeTempDir('export');
    const manifest = makeManifest();
    await seedRun(home, manifest);

    const json = await runCli(['export', manifest.id, '--format', 'json'], {
      home,
      test: t,
    });
    assert.equal(json.code, 0, json.stderr || json.stdout);
    assert.equal(JSON.parse(json.stdout).id, manifest.id);

    const markdown = await runCli(
      ['export', manifest.id, '--format', 'markdown'],
      { home, test: t }
    );
    assert.equal(markdown.code, 0, markdown.stderr || markdown.stdout);
    assert.match(markdown.stdout, /# Echo Black Box Run: cli seeded run/);
    assert.match(markdown.stdout, /## Timeline/);
    assert.match(markdown.stdout, /### 2\. Before assertion/);
  });

  it('export --redact scrubs common secret shapes from JSON and markdown', async (t) => {
    const home = await makeTempDir('export-redact');
    const manifest = makeManifest({
      command: [
        'node',
        '-e',
        'console.log("token=secret-token-123456789")',
      ],
      frames: [
        {
          id: 'frame-session',
          index: 1,
          kind: 'session',
          title: 'Run started',
          timestamp: '2026-05-29T12:00:00.000Z',
          summary: 'Authorization=Bearer abcdefghijklmnopqrstuvwxyz',
          data: {
            apiKey: 'sk-live-secretvalue',
            nested: {
              token: 'ghp_1234567890abcdef',
              note: 'password=hunter2',
            },
          },
        },
      ],
    });
    await seedRun(home, manifest);

    const json = await runCli(
      ['export', manifest.id, '--format', 'json', '--redact'],
      { home, test: t }
    );
    assert.equal(json.code, 0, json.stderr || json.stdout);
    assert.doesNotMatch(json.stdout, /secret-token-123456789/);
    assert.doesNotMatch(json.stdout, /sk-live-secretvalue/);
    assert.doesNotMatch(json.stdout, /ghp_1234567890abcdef/);
    assert.doesNotMatch(json.stdout, /hunter2/);
    assert.match(json.stdout, /\[REDACTED\]/);

    const markdown = await runCli(
      ['export', manifest.id, '--format', 'markdown', '--redact'],
      { home, test: t }
    );
    assert.equal(markdown.code, 0, markdown.stderr || markdown.stdout);
    assert.doesNotMatch(markdown.stdout, /abcdefghijklmnopqrstuvwxyz/);
    assert.match(markdown.stdout, /\[REDACTED\]/);
  });

  it('fork dry-run reports the planned branch and worktree without creating it', async (t) => {
    const home = await makeTempDir('fork');
    const gitRoot = await makeTempDir('git');
    const worktree = path.join(await makeTempDir('worktree-parent'), 'forked');

    await execFileAsync('git', ['init'], { cwd: gitRoot });
    await execFileAsync('git', ['config', 'user.name', 'Echo Test'], {
      cwd: gitRoot,
    });
    await execFileAsync('git', ['config', 'user.email', 'echo-test@example.com'], {
      cwd: gitRoot,
    });
    await fs.writeFile(path.join(gitRoot, 'README.md'), '# fixture\n');
    await execFileAsync('git', ['add', 'README.md'], { cwd: gitRoot });
    await execFileAsync('git', ['commit', '-m', 'fixture'], { cwd: gitRoot });
    const { stdout: head } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: gitRoot,
    });

    const manifest = makeManifest({
      id: '2026-05-29T12-10-00-000Z-fork-test',
      git: {
        isRepo: true,
        root: gitRoot,
        branch: 'main',
        head: head.trim(),
        dirtyBefore: false,
        dirtyAfter: false,
      },
    });
    await seedRun(home, manifest);

    const result = await runCli(
      [
        'fork',
        manifest.id,
        '--from',
        '2',
        '--branch',
        'echo-blackbox/test-fork',
        '--output',
        worktree,
        '--note',
        'try a safer branch',
      ],
      { home, test: t }
    );

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Run: 2026-05-29T12-10-00-000Z-fork-test/);
    assert.match(result.stdout, /Fork branch: echo-blackbox\/test-fork/);
    assert.match(result.stdout, new RegExp(worktree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(result.stdout, /Frame: \[2\] Before assertion/);
    assert.match(result.stdout, /Correction note: try a safer branch/);
    assert.match(result.stdout, /Dry run: no worktree created\./);
    assert.equal(await pathExists(worktree), false);
  });
});
