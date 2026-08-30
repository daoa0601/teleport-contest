// options.js — Parse .nethackrc options.
// C ref: options.c — handles OPTIONS=, BIND=, etc.

import { game } from './gstate.js';
import {
    PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM,
    PARANOID_DIE, PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY,
    PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP,
    PARANOID_WERECHANGE,
} from './const.js';

const DEFAULT_PARANOIA_BITS = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
const PARANOIA_OPTION_BITS = new Map([
    ['confirm', PARANOID_CONFIRM], ['paranoia', PARANOID_CONFIRM],
    ['quit', PARANOID_QUIT], ['explore', PARANOID_QUIT],
    ['die', PARANOID_DIE], ['death', PARANOID_DIE],
    ['bones', PARANOID_BONES],
    ['attack', PARANOID_HIT], ['hit', PARANOID_HIT],
    ['pray', PARANOID_PRAY],
    ['remove', PARANOID_REMOVE], ['takeoff', PARANOID_REMOVE],
    ['wand-break', PARANOID_BREAKWAND],
    ['break-wand', PARANOID_BREAKWAND],
    ['were-change', PARANOID_WERECHANGE],
    ['werechange', PARANOID_WERECHANGE],
    ['eat', PARANOID_EATING], ['continue', PARANOID_EATING],
    ['swim', PARANOID_SWIM], ['trap', PARANOID_TRAP],
    ['autoall', PARANOID_AUTOALL],
]);

function updateParanoiaBits(current, rawValue) {
    const value = rawValue.trim();
    let bits = current;
    let mode = 'replace';
    let fields = value;
    if (fields.startsWith('+') || fields.startsWith('-')) {
        mode = fields[0] === '+' ? 'add' : 'remove';
        fields = fields.slice(1).trim();
    } else {
        bits = 0;
    }
    for (let field of fields.split(/\s+/)) {
        if (!field) continue;
        let remove = mode === 'remove';
        if (field.startsWith('!')) {
            field = field.slice(1);
            if (mode !== 'remove') remove = true;
        }
        const name = field.toLowerCase();
        if (name === 'none') {
            if (mode === 'replace') bits = 0;
            continue;
        }
        if (name === 'all') {
            const all = [...new Set(PARANOIA_OPTION_BITS.values())]
                .reduce((mask, bit) => mask | bit, 0);
            bits = remove ? bits & ~all : bits | all;
            continue;
        }
        const bit = PARANOIA_OPTION_BITS.get(name);
        if (bit !== undefined)
            bits = remove ? bits & ~bit : bits | bit;
    }
    return bits;
}

export function parseNethackrc(rc) {
    const result = {
        name: '', role: null, race: null, gender: null, align: null,
        flags: {}, iflags: {},
    };
    let paranoiaBits = DEFAULT_PARANOIA_BITS;
    let paranoiaSeen = false;
    if (!rc) return result;

    for (const rawLine of rc.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const optMatch = line.match(/^OPTIONS=(.+)/i);
        if (!optMatch) continue;

        for (const opt of optMatch[1].split(',')) {
            const trimmed = opt.trim();
            if (!trimmed) continue;

            const negated = trimmed.startsWith('!');
            const stripped = negated ? trimmed.slice(1) : trimmed;

            const colonIdx = stripped.indexOf(':');
            if (colonIdx >= 0) {
                const key = stripped.slice(0, colonIdx).trim().toLowerCase();
                const val = stripped.slice(colonIdx + 1).trim();

                if (key === 'name') result.name = val;
                else if (key === 'role') result.role = val;
                else if (key === 'race') result.race = val;
                else if (key === 'gender') result.gender = val;
                else if (key === 'align') result.align = val;
                else if (key === 'playmode' && val === 'debug') result.flags.debug = true;
                else if (key === 'playmode' && val === 'explore') result.flags.explore = true;
                else if (key === 'pettype' || key === 'pet') {
                    result.flags.pettype = val;
                    if (val === 'none' || val === 'n') result.preferred_pet = 'n';
                    else if (val === 'dog' || val === 'd') result.preferred_pet = 'd';
                    else if (val === 'cat' || val === 'c') result.preferred_pet = 'c';
                }
                else if (key === 'symset') result.symset = val;
                else if (key === 'suppress_alert') result.flags.suppress_alert = val;
                else if (key === 'msg_window') result.iflags.prevmsg_window = val;
                else if (key === 'paranoid_confirmation'
                    || key === 'paranoid_confirm') {
                    paranoiaBits = updateParanoiaBits(paranoiaBits, val);
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else result.flags[key] = val;
            } else {
                // Boolean flag
                const lname = stripped.toLowerCase();
                const value = !negated;

                if (lname === 'autopickup') result.flags.pickup = value;
                else if (lname === 'color') result.flags.color = value;
                else if (lname === 'legacy') result.flags.legacy = value;
                else if (lname === 'pauper') {
                    result.flags.pauper = value;
                    // options.c applies this implication immediately, so a
                    // later explicit !nudist may still override it.
                    if (value) result.flags.nudist = true;
                }
                else if (lname === 'nudist') result.flags.nudist = value;
                else if (lname === 'blind' || lname === 'permablind')
                    result.flags.blind = value;
                else if (lname === 'deaf' || lname === 'permadeaf')
                    result.flags.deaf = value;
                else if (lname === 'tutorial') { result.flags.tutorial = value; result.tutorial_set = true; }
                else if (lname === 'splash_screen') result.iflags.wc_splash_screen = value;
                else if (lname === 'pushweapon') result.flags.pushweapon = value;
                else if (lname === 'showexp') result.flags.showexp = value;
                else if (lname === 'time') result.flags.time = value;
                else if (lname === 'verbose') result.flags.verbose = value;
                else if ((lname === 'paranoid_confirmation'
                    || lname === 'paranoid_confirm') && negated) {
                    paranoiaBits = 0;
                    paranoiaSeen = true;
                    result.flags.paranoia_bits = paranoiaBits;
                }
                else result.flags[lname] = value;
            }
        }
    }
    if (paranoiaSeen) result.flags.paranoia_bits = paranoiaBits;
    return result;
}
