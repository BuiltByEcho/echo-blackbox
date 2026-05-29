import process from 'node:process';
import { Command } from 'commander';
import { exportRun } from './exporter.js';
import { forkRun } from './fork.js';
import { formatRunLine, formatTimeline } from './format.js';
import { listRuns, readManifest, resolveRunId } from './io.js';
import { getRunDir } from './paths.js';
import { recordCommand } from './recorder.js';
const program = new Command();
program
    .name('echo-blackbox')
    .description('Terminal flight recorder for agent runs.')
    .version('0.1.0');
program
    .command('record')
    .description('Record a command as an Echo Black Box run.')
    .option('-n, --name <name>', 'Human-readable run name')
    .option('-C, --cwd <dir>', 'Working directory', process.cwd())
    .option('--no-passthrough', 'Capture output without printing it live')
    .option('--checkpoint <label>', 'Add a manual checkpoint label before the command starts', (value, previous = []) => [...previous, value], [])
    .allowUnknownOption(true)
    .argument('[command...]', 'Command to run. Prefer: echo-blackbox record -- npm test')
    .action(async (command, options) => {
    const cleaned = command[0] === '--' ? command.slice(1) : command;
    const run = await recordCommand(cleaned, {
        name: options.name,
        cwd: options.cwd,
        passthrough: options.passthrough,
        checkpoint: options.checkpoint,
    });
    console.error(`\nRecorded Echo Black Box run: ${run.id}`);
    console.error(`Open: echo-blackbox show ${run.id}`);
    process.exitCode = run.exitCode ?? 1;
});
program
    .command('runs')
    .alias('list')
    .description('List recorded runs.')
    .action(async () => {
    const runs = await listRuns();
    if (runs.length === 0) {
        console.log('No Echo Black Box runs found.');
        return;
    }
    for (const run of runs)
        console.log(formatRunLine(run));
});
program
    .command('show')
    .description('Show a run timeline.')
    .argument('[run]', 'Run id or latest', 'latest')
    .action(async (runValue) => {
    const runId = await resolveRunId(runValue);
    const run = await readManifest(runId);
    console.log(formatTimeline(run));
    console.log(`Artifacts: ${getRunDir(run.id)}`);
});
program
    .command('export')
    .description('Export a run as JSON or Markdown.')
    .argument('[run]', 'Run id or latest', 'latest')
    .option('-f, --format <format>', 'json or markdown', 'markdown')
    .option('--redact', 'Redact common tokens, secrets, and sensitive fields')
    .action(async (runValue, options) => {
    const format = options.format;
    if (format !== 'json' && format !== 'markdown') {
        throw new Error('Export format must be "json" or "markdown".');
    }
    const runId = await resolveRunId(runValue);
    process.stdout.write(await exportRun(runId, format, { redact: options.redact }));
});
program
    .command('fork')
    .description('Create a git worktree from the run snapshot. Defaults to dry-run.')
    .argument('[run]', 'Run id or latest', 'latest')
    .option('--from <step>', 'Frame index to fork conceptually from', (value) => Number.parseInt(value, 10))
    .option('-b, --branch <branch>', 'Branch name for the forked worktree')
    .option('-o, --output <dir>', 'Output directory for git worktree')
    .option('--note <note>', 'Correction note to include in the fork summary')
    .option('--dry-run', 'Preview the fork without creating a worktree')
    .option('--apply', 'Actually create the git worktree')
    .action(async (runValue, options) => {
    const runId = await resolveRunId(runValue);
    const result = await forkRun(runId, {
        from: options.from,
        branch: options.branch,
        output: options.output,
        note: options.note,
        dryRun: options.dryRun || !options.apply,
    });
    process.stdout.write(result);
});
program
    .command('where')
    .description('Print the local run storage path.')
    .argument('[run]', 'Optional run id or latest')
    .action(async (runValue) => {
    if (!runValue) {
        const { getBlackBoxPaths } = await import('./paths.js');
        console.log(getBlackBoxPaths().runsDir);
        return;
    }
    const runId = await resolveRunId(runValue);
    console.log(getRunDir(runId));
});
program.parseAsync(process.argv).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`echo-blackbox: ${message}`);
    process.exitCode = 1;
});
