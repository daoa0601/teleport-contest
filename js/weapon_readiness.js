// C wield.c:ready_weapon(), cant_wield_corpse(), and empty_handed().
import { speakArtifact } from './artifact_speech.js';
import { heroHandName } from './body_parts.js';
import { P_SABER, P_SHORT_SWORD } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { retouchHeroObject } from './hero_retouch.js';
import { heroSpecies } from './hero_species.js';
import { inventoryItemDescription } from './invent.js';
import { lightWieldedArtifact } from './light.js';
import { MONSTER_FLAGS1, requireMonsterData } from './monster_data.js';
import { shopkeeperName } from './monster_name.js';
import { AKLYS, BATTLE_AXE, CORPSE, OBJECT_BIMANUAL, OBJECT_SUBTYPE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { corpseName, killerObjectName, objectName, observeObjectForNaming } from './objnam.js';
import { insideShopRoomAt, shopResident } from './shk.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { announceWeaponWeld, explainTwoWeaponEnd } from './weapon_feedback.js';
import { setPrimaryWeapon } from './weapon_slots.js';
import { willWeld } from './weapon_type.js';
export function emptyHandedDescription(state = game) {
    if (state.uarmg || state.u.uarmg)
        return 'empty handed';
    const humanoid = requireMonsterData(MONSTER_FLAGS1, heroSpecies(state)) & 0x00020000;
    return humanoid ? 'bare handed' : 'not wielding anything';
}
// The caller has already checked whether the old weapon is welded. A failed
// touch spends a turn; a shield refusal does not. Neither installs the item.
export async function readyHeroWeapon(weapon, state = game) {
    requirePlayingGame(state);
    const previous = state.uwep || state.u.uwep;
    const wasTwoWeapon = state.u.twoweap;
    if (!weapon) {
        await pline(`You are ${previous ? '' : 'already '}${emptyHandedDescription(state)}.`);
        if (previous)
            await setPrimaryWeapon(null, state);
        return !!previous;
    }
    if (weapon.otyp === CORPSE && touchPetrifies(weapon.corpsenm)
        && !(state.uarmg || state.u.uarmg) && !heroResistsStoning(state)) {
        await pline(`You wield ${corpseName(weapon, { definite: true })} in your bare ${makePlural(heroHandName(state))}.`);
        await resolveImmediatePetrification({
            state, killer: `wielding ${killerObjectName(weapon, state)} bare-handed`,
        });
        return true;
    }
    if ((state.uarms || state.u.uarms) && OBJECT_BIMANUAL[weapon.otyp]) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] ?? 0;
        const kind = weapon.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER
            ? 'sword' : weapon.otyp === BATTLE_AXE ? 'axe' : 'weapon';
        await pline(`You cannot wield a two-handed ${kind} while wearing a shield.`);
        return false;
    }
    const touch = await retouchHeroObject(weapon, { state });
    if (touch.rejected || touch.died)
        return true;
    observeObjectForNaming(weapon, { state });
    if (willWeld(weapon)) {
        await announceWeaponWeld(weapon, state);
    }
    else {
        if (weapon.otyp === AKLYS)
            await pline('You secure the tether.');
        await pline(`${weapon.invlet} - ${inventoryItemDescription(weapon, { projectPrimaryHand: true })}.`);
    }
    await setPrimaryWeapon(weapon, state);
    await explainTwoWeaponEnd(wasTwoWeapon, state);
    if (weapon.oartifact)
        await speakArtifact(weapon, { state });
    await lightWieldedArtifact(weapon, state);
    if (weapon.unpaid) {
        const shop = insideShopRoomAt(state, state.u.ux, state.u.uy);
        const keeper = shopResident(shop?.roomno, state);
        if (keeper)
            await pline(`${shopkeeperName(keeper, { state })} says "You be careful with my ${objectName(weapon, state)}!"`);
    }
    return true;
}
//# sourceMappingURL=weapon_readiness.js.map