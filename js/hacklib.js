// hacklib.js — Utility functions.
// C ref: hacklib.c.
import { game } from './gstate.js';
export function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
export function dist2(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
// C ref: rn2(x) already in rng.js — re-export not needed
// C hacklib.c:ing_suffix(), including compound verbs such as "put on".
export function ingSuffix(verb) {
    const particle = verb.match(/ (?:on|off|with)$/i)?.[0] || '';
    let stem = particle ? verb.slice(0, -particle.length) : verb;
    if (!/er$/i.test(stem)) {
        if (/[^aeiouwy][aeiouwy][^aeiouwy]$/.test(stem))
            stem += stem.at(-1);
        else if (/ie$/i.test(stem))
            stem = stem.slice(0, -2) + 'y';
        else if (stem.endsWith('e'))
            stem = stem.slice(0, -1);
    }
    return stem + 'ing' + particle;
}
// C hacklib.c:upstart(). Convert the first character to uppercase.
export function upstart(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
// C hacklib.c:s_suffix(). The possessive of a name or noun phrase.
export function possessiveName(name) {
    if (name.toLowerCase() === 'it')
        return name + 's';
    if (name.toLowerCase() === 'you')
        return name + 'r';
    return name + (name.endsWith('s') ? "'" : "'s");
}
// C hack.h:online2() via the onlineu() macro. Two squares are online when
// they share a row, a column, or a perfect diagonal.
export function pointsOnline(x0, y0, x1, y1) {
    const dx = x0 - x1;
    const dy = y0 - y1;
    return !dx || !dy || dy === dx || dy === -dx;
}
// C hacklib.c:ordin().
export function ordinalSuffix(number) {
    const digit = number % 10;
    if (digit === 0 || digit > 3 || Math.trunc((number % 100) / 10) === 1)
        return 'th';
    return digit === 1 ? 'st' : digit === 2 ? 'nd' : 'rd';
}
// C hacklib.c:mungspaces() over one getlin line: tabs become spaces, runs
// collapse, and leading/trailing spaces vanish.
export function mungWishSpaces(text) {
    return text.replace(/\t/g, ' ').replace(/ +/g, ' ').trim();
}
//# sourceMappingURL=hacklib.js.map