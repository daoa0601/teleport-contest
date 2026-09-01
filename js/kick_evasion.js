// How a quick monster avoids a humanoid kick.
// C ref: dokick.c:kick_monster().

import { game } from './gstate.js';
import { couldsee } from './vision.js';
import { newsym, unmap_invisible } from './display.js';
import {
    MONSTER_FLAGS1, MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL,
} from './monster_data.js';
import { collectNearbyCoords } from './u_init.js';
import { rn2 } from './rng.js';
import { monsterGoodPosition, monsterTeleportRestricted } from './teleport_rules.js';

const M1_FLY = 0x00000001;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_NOLIMBS = 0x00006000;
const M1_SLITHY = 0x00080000;
const M1_THICK_HIDE = 0x00200000;
const M1_TPORT = 0x02000000;
const S_EYE = 5;
const S_LIGHT = 25;
const S_EEL = 57;
const PM_GRID_BUG = 116;

function nextOpenSquareNearHero(monster, state) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const destination = collectNearbyCoords(
            state.u.ux, state.u.uy, 3,
        ).find(({ x, y }) => monsterGoodPosition(
            monster.mnum, x, y, false, false, false, state,
        ));
        if (!destination) return null;
        const movesDiagonally = destination.x !== monster.mx
            && destination.y !== monster.my;
        if (!couldsee(destination.x, destination.y)
            || (monster.mnum === PM_GRID_BUG && movesDiagonally)) continue;

        const oldx = monster.mx;
        const oldy = monster.my;
        monster.mx = destination.x;
        monster.my = destination.y;
        monster.mtrack = [];
        unmap_invisible(oldx, oldy);
        newsym(oldx, oldy);
        newsym(monster.mx, monster.my);
        return { oldx, oldy, x: monster.mx, y: monster.my };
    }
    return null;
}

function evasionVerb(monster, state) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    if ((flags & M1_TPORT) && !monsterTeleportRestricted(monster, state))
        return 'teleports';
    if (symbol === S_EYE || symbol === S_LIGHT) return 'floats';
    if (flags & M1_FLY) return 'swoops';
    if ((flags & M1_NOLIMBS) === M1_NOLIMBS || (flags & M1_SLITHY))
        return 'slides';
    return 'jumps';
}

export async function tryKickEvasion(monster, {
    clumsy = false,
    martial = false,
    state = game,
    announce = async () => {},
    nameMonster = () => 'The monster',
} = {}) {
    if (rn2(clumsy ? 3 : 4) !== 0) return false;

    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const canEvade = (clumsy || (MONSTER_SIZE[monster.mnum] ?? 2) < 3)
        && monster.mcansee !== 0 && !monster.mtrapped
        && !(flags & M1_THICK_HIDE)
        && MONSTER_SYMBOL[monster.mnum] !== S_EEL
        && !(flags & M1_NOEYES)
        && monster.mcanmove !== 0 && !monster.mstun && !monster.mconf
        && !monster.msleeping && (MONSTER_MOVE[monster.mnum] ?? 0) >= 12;
    if (!canEvade) return false;

    if (!(flags & M1_NOHANDS) && rn2(martial ? 5 : 3) === 0) {
        await announce(
            `${nameMonster(monster)} blocks your ${clumsy ? 'clumsy ' : ''}kick.`,
        );
        return true;
    }

    const relocation = nextOpenSquareNearHero(monster, state);
    if (!relocation) return false;
    await announce(
        `${nameMonster(monster)} ${evasionVerb(monster, state)}, ${
            clumsy ? 'easily' : 'nimbly'
        } evading your ${clumsy ? 'clumsy ' : ''}kick.`,
    );
    return true;
}
