// wintty.c:render_status()'s BL_TITLE branch and botl.c:percentage().
export function hitpointBar(title: string, hp: number, maximum: number, critical: boolean): string {
    let text = title.slice(0, 30).padEnd(30);
    if (critical) {
        // repad_with_dashes() changes only trailing pairs of spaces.
        let end = text.length;
        while (end >= 2 && text.slice(end - 2, end) === '  ') {
            text = text.slice(0, end - 1) + '-' + text.slice(end);
            end -= 2;
        }
    }
    const health = Math.max(0, hp);
    let percent = maximum ? Math.trunc(100 * health / maximum) : 0;
    if (health && !percent) percent = 1;
    const width = percent >= 100 ? 30 : percent > 0
        ? Math.max(1, Math.min(29, Math.trunc(30 * percent / 100))) : 0;
    if (!width) return `[${text}]`;
    const blink = critical ? '\x1b[5m' : '';
    const rest = text.slice(width);
    return `[${blink}\x1b[7m${text.slice(0, width)}\x1b[0m${rest && blink ? blink : ''}${rest}${blink ? '\x1b[0m' : ''}]`;
}
