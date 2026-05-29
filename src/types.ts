export type FrameKind =
  | 'session'
  | 'checkpoint'
  | 'stdout'
  | 'stderr'
  | 'git'
  | 'exit'
  | 'note';

export type RunStatus = 'running' | 'success' | 'failed';

export type RunFrame = {
  id: string;
  index: number;
  kind: FrameKind;
  title: string;
  timestamp: string;
  summary?: string;
  data?: Record<string, unknown>;
};

export type RunManifest = {
  id: string;
  name: string;
  command: string[];
  cwd: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  storageVersion: 1;
  git?: {
    isRepo: boolean;
    root?: string;
    branch?: string;
    head?: string;
    dirtyBefore?: boolean;
    dirtyAfter?: boolean;
    diffBeforePath?: string;
    diffAfterPath?: string;
  };
  frames: RunFrame[];
};

export type BlackBoxPaths = {
  home: string;
  runsDir: string;
};

export type RecordOptions = {
  name?: string;
  cwd: string;
  passthrough: boolean;
  checkpoint?: string[];
};

export type ExportFormat = 'json' | 'markdown';

export type ForkOptions = {
  from?: number;
  branch?: string;
  output?: string;
  note?: string;
  dryRun?: boolean;
};
