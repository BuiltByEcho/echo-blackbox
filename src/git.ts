import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitSnapshot = {
  isRepo: boolean;
  root?: string;
  branch?: string;
  head?: string;
  dirty?: boolean;
  diff?: string;
};

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    maxBuffer: 1024 * 1024 * 20,
  });
  return stdout.trim();
}

export async function captureGitSnapshot(cwd: string): Promise<GitSnapshot> {
  try {
    const root = await git(cwd, ['rev-parse', '--show-toplevel']);
    const [branch, head, status, diff] = await Promise.all([
      git(cwd, ['branch', '--show-current']).catch(() => ''),
      git(cwd, ['rev-parse', 'HEAD']).catch(() => ''),
      git(cwd, ['status', '--short']).catch(() => ''),
      git(cwd, ['diff', '--binary']).catch(() => ''),
    ]);

    return {
      isRepo: true,
      root,
      branch: branch || 'detached',
      head,
      dirty: status.length > 0,
      diff,
    };
  } catch {
    return { isRepo: false };
  }
}

export async function createWorktree(options: {
  gitRoot: string;
  branch: string;
  output: string;
  baseRef?: string;
}): Promise<string> {
  const baseArgs = ['worktree', 'add', '-b', options.branch, options.output];
  if (options.baseRef) baseArgs.push(options.baseRef);
  await git(options.gitRoot, baseArgs);
  return options.output;
}
