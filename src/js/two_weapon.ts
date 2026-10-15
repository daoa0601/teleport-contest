// Two-weapon command admission, mode changes, and involuntary offhand drops.
// C refs: wield.c can_twoweapon(), dotwoweapon(), drop_uswapwep(), untwoweapon().

import { currentAttribute } from './attrib.js';
import { artifactByName } from './artifacts.js';
import { heroHandName } from './body_parts.js';
import { A_DEX, Upolyd } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { heroSpecies } from './hero_species.js';
import { dropInventoryObjectAtHero } from './hero_drop.js';
import { AT_WEAP } from './monster_attack_types.js';
import { MONSTER_ATTACKS, requireMonsterData } from './monster_data.js';
import { OBJECT_BIMANUAL } from './object_data.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import {
    objectHasPersonalName, objectName, objectNameIsPlural,
    ownedObjectAction, ownedObjectName,
} from './objnam.js';
import { rnd } from './rng.js';
import { setTwoWeaponCombat } from './weapon_slots.js';
import { isTwoWeaponObject } from './weapon_type.js';

// C mondata.h could_twoweap() examines only the first three attacks.
export function heroCanUseTwoWeapons(state: GameState = game): boolean {
    return requireMonsterData(MONSTER_ATTACKS, heroSpecies(state)).slice(0, 3)
        .filter(([type]) => type === AT_WEAP).length > 1;
}

function weaponName(object: GameObject, state: GameState): string {
    // C Yname2() omits ownership for personal, non-quest artifact names.
    if (object.where === 'inventory' && objectHasPersonalName(object, state)
        && object.oartifact !== undefined) {
        const firstQuestArtifact = artifactByName('The Orb of Detection', state);
        if (!firstQuestArtifact) throw new Error('The Orb of Detection is missing from the artifact table.');
        if (object.oartifact < firstQuestArtifact.id) return objectName(object, state);
    }
    return ownedObjectName(object, state);
}

export async function toggleTwoWeaponCombat(state: GameState = game): Promise<boolean> {
    if (state.u.twoweap) {
        await plineWithContinuation('You switch to your primary weapon.');
        setTwoWeaponCombat(false, state);
        return false;
    }
    if (!await canBeginTwoWeaponCombat(state)) return false;
    await plineWithContinuation('You begin two-weapon combat.');
    setTwoWeaponCombat(true, state);
    return rnd(20) > currentAttribute(A_DEX, state);
}

export async function canBeginTwoWeaponCombat(state: GameState): Promise<boolean> {
    const primary = state.uwep || state.u.uwep;
    const secondary = state.uswapwep || state.u.uswapwep;
    if (!heroCanUseTwoWeapons(state)) {
        if (Upolyd(state.u)) {
            await plineWithContinuation("You can't use two weapons in your current form.");
        } else {
            if (!state.urole) throw new Error('Two-weapon combat requires the hero role.');
            const role = state.flags?.female && state.urole.name.f
                ? state.urole.name.f : state.urole.name.m;
            await plineWithContinuation(`${makePlural(role)} aren't able to use two weapons at once.`);
        }
        return false;
    }
    if (!primary || !secondary) {
        const hand = heroHandName(state);
        const hands = !primary && !secondary ? makePlural(hand) : hand;
        const side = primary ? 'left ' : secondary ? 'right ' : '';
        await plineWithContinuation(`Your ${side}${hands} ${verbForSubject(hands, 'are')} empty.`);
        return false;
    }
    if (!isTwoWeaponObject(primary) || !isTwoWeaponObject(secondary)) {
        const object = !isTwoWeaponObject(primary) ? primary : secondary;
        const slot = object === primary ? 'primary' : 'secondary';
        const plural = objectNameIsPlural(object, state);
        await plineWithContinuation(`${weaponName(object, state)} ${
            plural ? "aren't" : "isn't a"} suitable ${slot} weapon${object.quan === 1 ? '' : 's'}.`);
        return false;
    }
    if (OBJECT_BIMANUAL[primary.otyp] || OBJECT_BIMANUAL[secondary.otyp]) {
        const object = OBJECT_BIMANUAL[primary.otyp] ? primary : secondary;
        await plineWithContinuation(`${weaponName(object, state)} isn't one-handed.`);
        return false;
    }
    if (state.uarms || state.u.uarms) {
        await plineWithContinuation("You can't use two weapons while wearing a shield.");
        return false;
    }
    if (secondary.oartifact) {
        await plineWithContinuation(`${ownedObjectAction(secondary, 'resist', state)} being held second to another weapon!`);
        return false;
    }
    // Corpses fail TWOWEAPOK above, before the Native stoning branch.
    const slippery = (state.u.glibTurns ?? 0) > 0 || !!state.u.glib;
    if (slippery || secondary.cursed) {
        if (!slippery) secondary.bknown = true;
        await dropSecondaryWeapon(state);
        return false;
    }
    return true;
}

// C curse(): this equipment reaction does not reveal BUC knowledge.
export async function dropCursedSecondaryWeapon(
    object: GameObject, state: GameState = game,
): Promise<void> {
    if (state.u.twoweap && object.cursed
        && object === (state.uswapwep || state.u.uswapwep))
        await dropSecondaryWeapon(state);
}

export async function dropSecondaryWeapon(state: GameState = game): Promise<void> {
    const object = state.uswapwep || state.u.uswapwep;
    if (!object) throw new Error('Dropping the secondary weapon requires an equipped object.');
    const hand = `left ${heroHandName(state)}`;
    if (!object.cursed) {
        await plineWithContinuation(`${ownedObjectAction(object, 'slip', state)} from your ${hand}!`);
    } else if (!state.u.twoweap) {
        const drop = objectNameIsPlural(object, state) ? 'drop' : 'drops';
        await plineWithContinuation(`${ownedObjectAction(object, 'evade', state)} your grasp and ${drop} from your ${hand}!`);
    } else {
        const name = ownedObjectAction(object, null, state, { capitalized: false });
        await plineWithContinuation(`Your ${hand} spasms and drops ${name}!`);
    }
    await dropInventoryObjectAtHero(object, { state });
}

export async function stopTwoWeaponCombat(state: GameState = game): Promise<void> {
    if (!state.u.twoweap) return;
    await plineWithContinuation('You can no longer wield two weapons at once.');
    setTwoWeaponCombat(false, state);
}
