// wintty.c:render_status()'s BL_TITLE branch.  The tty draws the bar's
// colour and attribute from the title cell's stored style
// (StatusHighlights.barStyle), so this builds only the bracketed text;
// wintty.c:5212-5213 repads a critical title's trailing space pairs with
// dashes.
// C botl.c:repad_with_dashes().
export function hitpointBar(title, critical) {
    let text = title.slice(0, 30).padEnd(30);
    if (critical) {
        // repad_with_dashes() changes only trailing pairs of spaces.
        let end = text.length;
        while (end >= 2 && text.slice(end - 2, end) === '  ') {
            text = text.slice(0, end - 1) + '-' + text.slice(end);
            end -= 2;
        }
    }
    return `[${text}]`;
}
// botl.c:percentage() feeding wintty.c:5220-5229's bar_pos, the number of
// lit cells in the fixed thirty-character bar.  Dead heroes light nothing;
// a nonzero health fraction keeps one cell even above the display cap.
export function hitpointBarFill(hp, maximum) {
    const health = Math.max(0, hp);
    let percent = maximum ? Math.trunc(100 * health / maximum) : 0;
    if (health && !percent)
        percent = 1;
    if (percent >= 100)
        return 30;
    if (!percent)
        return 0;
    return Math.max(1, Math.min(29, Math.trunc(30 * percent / 100)));
}
//# sourceMappingURL=status_hitpoint_bar.js.map