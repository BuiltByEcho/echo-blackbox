# Echo Black Box Run: release-smoke

- ID: `2026-05-29T17-42-12-612Z-release-smoke-eHd8Q_`
- Status: `success`
- Command: `node -e console.log('token=[REDACTED]'); console.error('stderr ok')`
- CWD: `/tmp/echo-blackbox-release-git`
- Started: 2026-05-29T17:42:12.612Z
- Finished: 2026-05-29T17:42:12.691Z
- Exit code: 0
- Git: `main @ 02cc264b1cbd`

## Timeline

### 1. Run started

- Kind: `session`
- Time: 2026-05-29T17:42:12.614Z
- Summary: node -e console.log('token=[REDACTED]'); console.error('stderr ok')

```json
{
  "command": [
    "node",
    "-e",
    "console.log('token=[REDACTED]'); console.error('stderr ok')"
  ],
  "cwd": "/tmp/echo-blackbox-release-git"
}
```

### 2. Git snapshot before run

- Kind: `git`
- Time: 2026-05-29T17:42:12.632Z
- Summary: main

```json
{
  "root": "/tmp/echo-blackbox-release-git",
  "branch": "main",
  "head": "02cc264b1cbd0ed9802fe4d8943a186449220b1b",
  "dirty": false
}
```

### 3. Captured stdout

- Kind: `stdout`
- Time: 2026-05-29T17:42:12.674Z
- Summary: stdout.log

### 4. Captured stderr

- Kind: `stderr`
- Time: 2026-05-29T17:42:12.674Z
- Summary: stderr.log

### 5. Git snapshot after run

- Kind: `git`
- Time: 2026-05-29T17:42:12.691Z
- Summary: main

```json
{
  "root": "/tmp/echo-blackbox-release-git",
  "branch": "main",
  "head": "02cc264b1cbd0ed9802fe4d8943a186449220b1b",
  "dirty": false
}
```

### 6. Run completed

- Kind: `exit`
- Time: 2026-05-29T17:42:12.691Z
- Summary: exit code 0

```json
{
  "exitCode": 0
}
```
