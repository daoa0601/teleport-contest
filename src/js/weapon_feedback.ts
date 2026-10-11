// Readiness messages around a semantic primary-weapon change.
// C refs: wield.c ready_weapon(), before and after setuwep().

import { heroHandName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { objectHasPersonalName, objectName, ownedObjectAction } from './objnam.js';
import { isTwoWeaponObject, willWeld } from './weapon_type.js';

export async function refuseWeldedPrimary(state: GameState = game): Promise<boolean> {
    const weapon = state.uwep || state.u.uwep;
    if (!weapon || !willWeld(weapon)) return false;
    weapon.bknown = true;
    const hand = heroHandName(state);
    const hands = OBJECT_BIMANUAL[weapon.otyp] ? makePlural(hand) : hand;
    await plineWithContinuation(`${ownedObjectAction(weapon, 'are', state)} welded to your ${hands}!`);
    return true;
}

export async function announceWeaponWeld(object: GameObject, state: GameState = game): Promise<void> {
    const noun = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    const proper = objectHasPersonalName(object, state);
    const article = proper && !noun.includes(' of ') ? '' : 'The ';
    const subject = quantity === 1 ? noun : `${quantity} ${makePlural(noun)}`;
    const side = state.u.rightHanded === false ? 'left' : 'right';
    const hand = heroHandName(state);
    const hands = OBJECT_BIMANUAL[object.otyp]
        ? makePlural(hand) : `dominant ${side} ${hand}`;
    await plineWithContinuation(`${article}${subject} ${
        quantity === 1 ? 'welds itself' : 'weld themselves'} to your ${hands}!`);
    object.bknown = true;
}

export async function explainTwoWeaponEnd(
    wasTwoWeapon: boolean | undefined, state: GameState = game,
): Promise<void> {
    const weapon = state.uwep || state.u?.uwep;
    if (!wasTwoWeapon || state.u.twoweap || !weapon
        || state.flags?.verbose === false) return;
    const suitable = isTwoWeaponObject(weapon) && !OBJECT_BIMANUAL[weapon.otyp];
    await plineWithContinuation(suitable
        ? 'You are no longer using two weapons at once.'
        : 'You can no longer wield two weapons at once.');
}
