// The vibrating square at the invocation position.
// C refs: hack.c invocation_message() and trap.c
// trapeffect_vibrating_square().

import { heroFootName } from './body_parts.js';
import { Invocation_lev, VIBRATING_SQUARE } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { monsterTypeName } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import {
    CANDELABRUM_OF_INVOCATION, OBJECT_NAMES,
} from './object_data.js';
import { stopRun } from './runmode.js';

function vibratingSquareAtHero() {
    if (!Invocation_lev(game.u?.uz)) return null;
    return game.level?.traps?.find(trap =>
        trap.ttyp === VIBRATING_SQUARE
        && trap.tx === game.u?.ux && trap.ty === game.u?.uy) || null;
}

function heroIsOnStairs() {
    const x = game.u?.ux;
    const y = game.u?.uy;
    if (game.level?.upstair?.x === x && game.level.upstair.y === y)
        return true;
    if (game.level?.dnstair?.x === x && game.level.dnstair.y === y)
        return true;
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y) return true;
    }
    return false;
}

function heroPositionDescription() {
    const steed = game.u?.usteed;
    if (steed) {
        const name = steed.name
            || `your ${monsterTypeName(steed.mnum, !!steed.female)}`;
        return `beneath ${name}`;
    }
    if (game.u?.levitating || game.u?.levitation
        || game.u?.flying || game.u?.flight) return 'beneath you';
    return `under your ${makePlural(heroFootName())}`;
}

function carriedCandelabrum() {
    return (game.inventory || []).find(object =>
        object.otyp === CANDELABRUM_OF_INVOCATION);
}

export async function announceInvocationSquare() {
    const trap = vibratingSquareAtHero();
    if (!trap || heroIsOnStairs()) return false;

    stopRun();
    await plineWithContinuation(
        `You feel a strange vibration ${heroPositionDescription()}.`,
    );
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.uvibrated = 1;

    const candelabrum = carriedCandelabrum();
    if (candelabrum?.spe === 7 && candelabrum.lamplit) {
        const name = OBJECT_NAMES[candelabrum.otyp]
            || 'Candelabrum of Invocation';
        await plineWithContinuation(
            `The ${name} ${game.blind ? 'throbs palpably'
                : 'glows with a strange light'}!`,
        );
    }
    return true;
}

export function revealVibratingSquare(trap) {
    if (!trap || trap.ttyp !== VIBRATING_SQUARE) return false;
    trap.tseen = true;
    newsym(trap.tx, trap.ty);
    return true;
}
