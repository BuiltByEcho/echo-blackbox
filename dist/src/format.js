export function formatRunLine(run) {
    const exit = typeof run.exitCode === 'number' ? ` exit=${run.exitCode}` : '';
    return `${run.id}  ${run.status.padEnd(7)}  ${run.name}  ${run.startedAt}${exit}`;
}
export function formatTimeline(run) {
    const lines = [
        `Echo Black Box Run: ${run.name}`,
        `ID: ${run.id}`,
        `Status: ${run.status}`,
        `Command: ${run.command.join(' ')}`,
        `CWD: ${run.cwd}`,
        `Started: ${run.startedAt}`,
    ];
    if (run.finishedAt)
        lines.push(`Finished: ${run.finishedAt}`);
    if (typeof run.exitCode === 'number')
        lines.push(`Exit: ${run.exitCode}`);
    if (run.git?.isRepo) {
        lines.push(`Git: ${run.git.branch || 'unknown'} @ ${(run.git.head || '').slice(0, 12)}`);
    }
    lines.push('', 'Timeline:');
    for (const frame of run.frames) {
        lines.push(`[${frame.index}] ${frame.kind.toUpperCase()} ${frame.title}${frame.summary ? ` - ${frame.summary}` : ''}`);
    }
    return `${lines.join('\n')}\n`;
}
export function formatMarkdown(run) {
    const lines = [
        `# Echo Black Box Run: ${run.name}`,
        '',
        `- ID: \`${run.id}\``,
        `- Status: \`${run.status}\``,
        `- Command: \`${run.command.join(' ')}\``,
        `- CWD: \`${run.cwd}\``,
        `- Started: ${run.startedAt}`,
    ];
    if (run.finishedAt)
        lines.push(`- Finished: ${run.finishedAt}`);
    if (typeof run.exitCode === 'number')
        lines.push(`- Exit code: ${run.exitCode}`);
    if (run.git?.isRepo) {
        lines.push(`- Git: \`${run.git.branch || 'unknown'} @ ${(run.git.head || '').slice(0, 12)}\``);
    }
    lines.push('', '## Timeline', '');
    for (const frame of run.frames) {
        lines.push(`### ${frame.index}. ${frame.title}`, '');
        lines.push(`- Kind: \`${frame.kind}\``);
        lines.push(`- Time: ${frame.timestamp}`);
        if (frame.summary)
            lines.push(`- Summary: ${frame.summary}`);
        if (frame.data) {
            lines.push('', '```json');
            lines.push(JSON.stringify(frame.data, null, 2));
            lines.push('```');
        }
        lines.push('');
    }
    return lines.join('\n');
}
