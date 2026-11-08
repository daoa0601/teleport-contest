// rip.js — the rip.c owner: the tombstone composed for the end screen.
// C ref: rip.c — genl_outrip(), center().
// C rip.c:center()
export function tombstoneLine(value) {
    const text = String(value).slice(0, 16);
    const col = 28 - Math.trunc((text.length + 1) / 2);
    return `${' '.repeat(col - 19)}${text}${' '.repeat(37 - col - text.length)}`;
}
// Part of C rip.c:genl_outrip(): the death year (yyyymmdd(when)/10000
// % 10000, printed %4d).
export function tombstoneYear(when) {
    const year = Number(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric',
    }).format(new Date(when * 1000)));
    // C calendar.c:yyyymmdd() treats tm_year below 70 as a two-digit year.
    const calendarYear = year < 1970 ? year + 100 : year;
    return String(calendarYear % 10000).padStart(4, ' ');
}
// C rip.c:genl_outrip().  The stone receives up to four cause rows, each at
// most sixteen characters, split backward at a word boundary when possible.
export function tombstoneDeathRows(cause) {
    let remaining = String(cause || '');
    const rows = [];
    for (let row = 0; row < 4; row++) {
        if (!remaining) {
            rows.push('');
            continue;
        }
        let count = remaining.length;
        if (count > 16) {
            const space = remaining.lastIndexOf(' ', 16);
            // Native's backward scan reaches zero after a space at index
            // one, so that case hard-splits just like an unbroken word.
            count = space > 1 ? space : 16;
        }
        rows.push(remaining.slice(0, count));
        remaining = remaining[count] === ' '
            ? remaining.slice(count + 1) : remaining.slice(count);
    }
    return rows;
}
//# sourceMappingURL=rip.js.map