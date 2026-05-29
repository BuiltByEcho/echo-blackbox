# Echo Black Box Release Checklist

Use this before publishing `@builtbyecho/blackbox`.

## Local Gates

- `npm ci`
- `npm run ci`
- Install the packed tarball into a temp prefix and run:
  - `echo-blackbox --help`
  - `echo-blackbox record -- node -e "console.log('ok')"`
  - `echo-blackbox export latest --format json`
  - `echo-blackbox export latest --format markdown --redact`
  - `echo-blackbox fork latest --from 1` from a committed git fixture

## CI Gates

- GitHub Actions green on:
  - Node 20, 22, 24
  - macOS latest
  - Ubuntu latest

## Safety Gates

- Confirm exports are treated as sensitive local artifacts.
- Use `export --redact` before sharing run bundles outside the machine.
- Do not upload captured logs, diffs, or manifests unless Dustin explicitly approves.
- Review README examples for private paths, secrets, or location leakage.

## Publish Gates

- Confirm npm account and package scope intentionally.
- Confirm GitHub repo owner intentionally.
- Tag the exact released commit.
- Keep npm package contents limited to `bin`, `dist`, README, LICENSE, NOTICE, and package metadata.
