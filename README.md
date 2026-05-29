# Echo Black Box

Terminal flight recorder for agent runs.

Echo Black Box is a local-first CLI for capturing an agent session as it happens: commands, outputs, notes, checkpoints, and enough surrounding context to understand what changed later. The goal is simple: make agent work reviewable, exportable, and forkable without turning the product into a surveillance layer.

It is built for the messy middle of real agent work:

- record a run while an agent builds, debugs, or investigates
- review what happened after the fact
- export a clean artifact for handoff, audit, or support
- fork from a known checkpoint when a run takes the wrong branch

## Status

Early working v0. The CLI can record shell commands, capture stdout/stderr,
store git snapshots/diffs, list runs, show a timeline, export JSON/Markdown,
and prepare a safe dry-run fork plan. Actual git worktree creation requires
`echo-blackbox fork --apply`.

## Install

```sh
npm install
```

For local development:

```sh
npm run build
npm run check
```

When published, the intended global install shape is:

```sh
npm install -g @builtbyecho/blackbox
echo-blackbox --help
```

## Usage

The CLI centers on a few plain commands:

```sh
echo-blackbox record -- npm test
echo-blackbox runs
echo-blackbox show latest
echo-blackbox export latest --format markdown
echo-blackbox export latest --format markdown --redact
echo-blackbox fork latest --from 4 --note "Use $ECHO on Base, not Stripe"
```

The first usable version biases toward boring, dependable files over a complex service:

- `record` starts a local run log and wraps a command
- `runs` lists captured runs
- `show` summarizes and navigates a captured run timeline
- `export` writes a portable bundle for sharing or archival
- `export --redact` scrubs common token, secret, password, and authorization shapes before printing
- `fork` prepares a new working branch/worktree from a prior run state

## Development Commands

```sh
npm run build      # compile TypeScript
npm start          # run compiled CLI from dist/src/cli.js
npm test           # run node:test tests after build
npm run check      # build and test
npm run ci         # build, test, and dry-run package contents
npm run pack:dry   # inspect npm package contents
```

## Storage Model

Echo Black Box defaults to local storage:

- one directory per recorded run under `~/.config/echo-blackbox/runs`
- append-only `frames.jsonl` event log for command/session activity
- `manifest.json` metadata for run id, timestamps, command, project path, frames, and git state
- `stdout.log` and `stderr.log` command output artifacts
- `diff-before.patch` and `diff-after.patch` when the command runs inside a git repo
- checkpoint manifests that point at captured state instead of duplicating everything blindly
- export bundles that can be inspected without a running service

Sensitive content must be treated as local user data. Do not upload, sync, or publish run artifacts unless the user explicitly chooses to export or connect them to another system.

## Safety Notes

Agent sessions can contain secrets, private paths, personal messages, customer data, and credentials printed by accident. Echo Black Box should be conservative by default:

- keep captures local unless explicitly exported
- make redaction available before sharing
- use `echo-blackbox export --redact` for shareable JSON or Markdown exports
- avoid recording raw environment variables by default
- mark exports as potentially sensitive
- prefer explicit allowlists over broad collection
- never present a recording as proof of security, correctness, or authorization by itself

## Release Readiness

The repo includes a CI workflow for Node 20, 22, and 24 on macOS and Ubuntu.
Before publishing, run through `RELEASE_CHECKLIST.md` and verify the packed
tarball install path, not only the local source tree.

## Echo Gate Direction

Echo Black Box should become the run recorder that Echo Gate can trust but not blindly expose.

The likely integration path:

- Echo Gate grants or denies tool actions
- Echo Black Box records the local run context around those actions
- receipts/authorization metadata can be attached to checkpoints
- exported bundles can include Echo Gate action ids without leaking private keys or raw secrets
- future paid or permissioned agent workflows can require a Black Box export for support, review, or dispute handling

In short: Echo Gate controls what an agent may do; Echo Black Box preserves what happened around the run.

## Attribution

Echo Black Box is an original BuiltByEcho terminal tool. Its product direction is inspired by public agent replay/debugging patterns, including the MIT-licensed Agent VCR project:

<https://github.com/ixchio/agent-vcr>

No Agent VCR source code is vendored in this package.

## License

MIT. See `LICENSE`.
