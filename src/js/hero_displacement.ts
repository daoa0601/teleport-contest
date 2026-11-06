// Native do_wear.c:toggle_displacement() for eating and timeout expiry.

import { heroIsDisplaced } from './do_wear.js';

import { TIMEOUT } from './const.js';
import { formatFeltMessage, plineWithContinuation } from './pline.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { hasWornProperty, propertyIsActive, refreshProperty } from './properties.js';
import { heroIsBlind } from './senses.js';
import { d } from './rng.js';

// Part of C eat.c:cpostfx(): the PM_DISPLACER_BEAST branch —
// toggle_displacement() before gaining incr_itimeout(&HDisplaced, d(6, 6)).
export async function gainCorpseDisplacement({ state = game }: { state?: GameState } = {}): Promise<void> {
    if (!heroIsDisplaced(state)) await announceDisplacementChange(true, state);
    state.u.displacedTurns = Math.min(TIMEOUT, (state.u.displacedTurns || 0) + d(6, 6));
    refreshProperty('displaced', state);
}

// Part of C timeout.c:nh_timeout(): the DISPLACED decrement and its expiry
// toggle_displacement(0, 0, FALSE).
export async function advanceDisplacementTimeout(state: GameState = game): Promise<void> {
    const turns = state.u.displacedTurns;
    if (turns === undefined || turns <= 0) return;
    state.u.displacedTurns = turns - 1;
    if (state.u.displacedTurns) return;
    refreshProperty('displaced', state);
    if (!heroIsDisplaced(state)) await announceDisplacementChange(false, state);
}

// C do_wear.c:toggle_displacement(): the message test — see self, or
// sense monsters via telepathy or monster detection.
async function announceDisplacementChange(on: boolean, state: GameState): Promise<void> {
    const hero = state.u;
    const blind = heroIsBlind(state);
    const unseen = heroIsInvisible(state) && !propertyIsActive('seeInvisible', state);
    const seesSelf = !blind && !hero.uswallow && !unseen;
    const sensesMonsters = hasWornProperty('telepathy', state)
        || (hero.unblind_telepat_range ?? -1) >= 0
        || blind && propertyIsActive('telepathy', state)
        || (hero.monsterDetectionTurns ?? 0) > 0;
    if (hero.displacementBlocked || hero.displacedBlocked || !(seesSelf || sensesMonsters)) return;
    await plineWithContinuation(formatFeltMessage(`that monsters${on ? '' : ' no longer'} have difficulty pinpointing your location.`, state));
}
