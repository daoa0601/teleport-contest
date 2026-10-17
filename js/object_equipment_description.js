// C objnam.c:doname_base(), worn and held object annotations.
import { pendingArmorAction } from './command_state.js';
import { artifactEmitsLight, artifactGlowColor } from './artifacts.js';
import { artifactGlowVerb, wieldedArtifactWarns } from './artifact_warning.js';
import { heroHandName } from './body_parts.js';
import { P_BOW, W_AMUL, W_ARMOR, W_BALL, W_CHAIN, W_QUIVER, W_RING, W_RINGL, W_RINGR, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEP, } from './const.js';
import { displayColorName } from './display.js';
import { game } from './gstate.js';
import { equipmentLightDescription } from './light.js';
import { AKLYS, MEAT_RING, OBJECT_BIMANUAL, OBJECT_SUBTYPE } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { isLauncherAmmunition, isMissileObject, isWeaponTool } from './object_properties.js';
import { heroIsBlind } from './senses.js';
import { isBeingTakenOff } from './takeoff_state.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const RING_CLASS = 4;
const AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const FOOD_CLASS = 7;
const WAND_CLASS = 11;
const COIN_CLASS = 12;
const GEM_CLASS = 13;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
export function wornObjectDescription(item, state = game) {
    const mask = item.owornmask ?? 0;
    switch (isWeaponTool(item) ? WEAPON_CLASS : item.oclass) {
        case AMULET_CLASS:
            return mask & W_AMUL ? ' (being worn)' : '';
        case ARMOR_CLASS:
            return mask & W_ARMOR ? wornArmorDescription(item, state) : '';
        case TOOL_CLASS:
            return mask & (W_TOOL | W_SADDLE) ? ' (being worn)' : '';
        case RING_CLASS:
            return wornRingDescription(mask, state);
        case FOOD_CLASS:
            return item.otyp === MEAT_RING ? wornRingDescription(mask, state) : '';
        case BALL_CLASS:
        case CHAIN_CLASS:
            return mask & (W_BALL | W_CHAIN)
                ? ` (${mask & W_BALL ? 'chained' : 'attached'} to you)` : '';
        default:
            return '';
    }
}
export function heldObjectDescription(item, { state = game, primaryHandDetail = null, projectPrimaryHand = false, } = {}) {
    const mask = (item.owornmask ?? 0) | (projectPrimaryHand ? W_WEP : 0);
    let description = '';
    if (mask & W_WEP) {
        if (usesPrimaryHandPhrase(item, state)) {
            const hand = isBimanual(item) ? makePlural(heroHandName(state))
                : `${state.u.rightHanded === false ? 'left' : 'right'} ${heroHandName(state)}`;
            const action = item.otyp === AKLYS ? 'tethered to'
                : isTwoWeaponPrimary(item, state) ? 'wielded in' : 'weapon in';
            const detail = primaryHandDetail ? `, ${primaryHandDetail}` : '';
            description += ` (${action} ${hand}${detail})`;
        }
        else {
            description += ' (wielded)';
        }
    }
    if (mask & W_SWAPWEP) {
        description += state.u.twoweap
            ? ` (wielded in ${state.u.rightHanded === false ? 'right' : 'left'} ${heroHandName(state)})`
            : ` (alternate weapon${item.quan === 1 ? '' : 's'}; not wielded)`;
    }
    if (mask & W_QUIVER)
        description += ` (${quiverDescription(item)})`;
    return description;
}
// Materialize only at a menu/prinv boundary: hallucinated glow colors draw
// from display RNG, and the native abbreviated "(wielded)" has no light detail.
export function primaryHandDescriptionDetail(item, state = game) {
    if (!((item.owornmask ?? 0) & W_WEP)
        || !usesPrimaryHandPhrase(item, state) || heroIsBlind(state))
        return null;
    if (item === state.uwep && state.warn_obj_cnt > 0 && wieldedArtifactWarns(state)) {
        return `${artifactGlowVerb(state.warn_obj_cnt, true)} ${displayColorName(artifactGlowColor(item, state), state)}`;
    }
    return item.lamplit && artifactEmitsLight(item)
        ? `${equipmentLightDescription(item, state)} lit` : null;
}
function wornArmorDescription(item, state) {
    const pending = pendingArmorAction(state);
    const dressing = pending?.object === item ? pending.kind : null;
    let description = item === (state.uskin || state.u.uskin) ? 'embedded in your skin'
        : dressing === 'remove' || isBeingTakenOff(item, state) ? 'being doffed'
            : dressing === 'wear' ? 'being donned' : 'being worn';
    description = ` (${description})`;
    // Native Concat(bp, 1, ...) uses strncat(), which still appends after the
    // closing parenthesis it meant to replace; the light text uses snprintf()
    // and does replace it.
    if (item === (state.uarmg || state.u.uarmg)
        && (state.u.glib || (state.u.glibTurns ?? 0) > 0))
        description += '; slippery)';
    if (!heroIsBlind(state) && item.lamplit && artifactEmitsLight(item))
        description = `${description.slice(0, -1)}, ${equipmentLightDescription(item, state)} lit)`;
    return description;
}
function wornRingDescription(mask, state) {
    if (!(mask & W_RING))
        return '';
    let description = '';
    if (mask & W_RINGR)
        description += ' (on right ';
    if (mask & W_RINGL)
        description += ' (on left ';
    return `${description}${heroHandName(state)})`;
}
function usesPrimaryHandPhrase(item, state) {
    if (isTwoWeaponPrimary(item, state))
        return true;
    if (item.quan !== 1)
        return false;
    return item.oclass === WEAPON_CLASS
        ? !isLauncherAmmunition(item) && !isMissileObject(item) : isWeaponTool(item);
}
function isTwoWeaponPrimary(item, state) {
    return item === (state.uwep || state.u.uwep) && !!state.u.twoweap;
}
function isBimanual(item) {
    return (item.oclass === WEAPON_CLASS || item.oclass === TOOL_CLASS)
        && !!OBJECT_BIMANUAL[item.otyp];
}
function quiverDescription(item) {
    switch (item.oclass) {
        case WEAPON_CLASS:
            return !isLauncherAmmunition(item) ? 'at the ready'
                : OBJECT_SUBTYPE[item.otyp] === -P_BOW ? 'in quiver' : 'in quiver pouch';
        case RING_CLASS:
        case AMULET_CLASS:
        case WAND_CLASS:
        case COIN_CLASS:
        case GEM_CLASS:
            return 'in quiver pouch';
        default:
            return 'at the ready';
    }
}
//# sourceMappingURL=object_equipment_description.js.map