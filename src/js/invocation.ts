// The vibrating square at the invocation position.
// C refs: hack.c invocation_message() and trap.c
// trapeffect_vibrating_square().

import { formatFeltMessage } from './hero_speech.js';
import { heroFootName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameObject } from './object_types.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { makePlural } from './object_grammar.js';
import {
    CANDELABRUM_OF_INVOCATION,
} from './object_data.js';
import { stopRun } from './runmode.js';
import { monsterName } from './monster_name.js';
import { definiteObjectAction } from './objnam.js';

function heroPositionDescription(): string {
    const steed = game.u?.usteed;
    if (steed) {
        const name = monsterName(steed, { article: 'your' });
        return `beneath ${name}`;
    }
    if (game.u.levitating || game.u.flying) return 'beneath you';
    return `under your ${makePlural(heroFootName())}`;
}

function carriedCandelabrum(): GameObject | undefined {
    return (game.inventory || []).find(object =>
        object.otyp === CANDELABRUM_OF_INVOCATION);
}

export async function announceInvocationSquare(): Promise<boolean> {
    if (!isInvocationPosition(game.u?.ux, game.u?.uy)
        || heroIsOnStairs()) return false;

    stopRun();
    await plineWithContinuation(
        formatFeltMessage(`a strange vibration ${heroPositionDescription()}.`),
    );
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.uvibrated = 1;

    const candelabrum = carriedCandelabrum();
    if (candelabrum?.spe === 7 && candelabrum.lamplit) {
        await plineWithContinuation(
            `${definiteObjectAction(candelabrum, null)} ${game.blind ? 'throbs palpably'
                : 'glows with a strange light'}!`,
        );
    }
    return true;
}
