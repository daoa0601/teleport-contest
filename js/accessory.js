// Rings and amulets worn by the hero.
// C refs: worn.c:setworn(), do_wear.c:Ring_on(), Ring_off(), Amulet_on(),
// and Amulet_off().
import { A_CHA, A_CON, A_STR, Upolyd, W_AMUL, W_RINGL, W_RINGR } from './const.js';
import { attributeIsAtLimit, currentAttribute } from './attrib.js';
import { findArmorClass } from './armor.js';
import { game, requireLiveGame } from './gstate.js';
import { AMULET_OF_CHANGE, AMULET_OF_GUARDING, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, OBJECT_BIMANUAL, OBJECT_CHARGED, OBJECT_NAMES, OBJECT_PROPERTY, RIN_PROTECTION, } from './object_data.js';
import { learnObjectType } from './object_knowledge.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { captureLevitationState, grantWornProperty, propertyIsActive, refreshMovementProperties, removeWornProperty, } from './properties.js';
import { isWeldedPrimary, releaseWeaponSlots } from './weapon_slots.js';
import { cancelSlotTakeoff } from './takeoff_state.js';
import { heroHasNoLimbs, heroIsUnchanging } from './polyself.js';
import { changeHeroSex, heroPolyGender } from './hero_species.js';
import { newsym, plineWithContinuation } from './display.js';
import { consumeInventoryItem } from './invent.js';
import { objectWearMessage } from './object_wear_message.js';
import { tryCallObjectType } from './object_call.js';
import { recordGameLogEvent } from './gamelog.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { experienceRankIndex } from './exper.js';
import { clearHeroSliming, heroIsSliming } from './slime.js';
import { heroIsInDangerousRegion } from './regions.js';
import { rnd } from './rng.js';
import { monsterName } from './monster_name.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { applyHeroLocationEffects } from './cmd.js';
import { restartMonsterShapechanging, restoreNaturalMonsterShapes } from './monster_polymorph.js';
import { clearHeroStrangulation, heroIsStrangled, startAmuletStrangulation, } from './hero_strangulation.js';
const ACCESSORY_SLOTS = [
    { slot: 'uleft', mask: W_RINGL, label: 'left-ring' },
    { slot: 'uright', mask: W_RINGR, label: 'right-ring' },
    { slot: 'uamul', mask: W_AMUL, label: 'uamul' },
];
const RING_ATTRIBUTES = new Map([
    [OBJECT_NAMES.indexOf('gain strength'), A_STR],
    [OBJECT_NAMES.indexOf('gain constitution'), A_CON],
    [OBJECT_NAMES.indexOf('adornment'), A_CHA],
]);
const RIN_INCREASE_ACCURACY = OBJECT_NAMES.indexOf('increase accuracy');
const RIN_INCREASE_DAMAGE = OBJECT_NAMES.indexOf('increase damage');
// C do_wear.c:stuck_ring(). Find what prevents this ring from coming off.
export function ringRemovalObstacle(ring, type, state = game) {
    if (!ring || ring.otyp !== type)
        return null;
    const amulet = state.uamul;
    if (heroHasNoLimbs(state)
        && amulet?.otyp === AMULET_OF_UNCHANGING && amulet.cursed)
        return amulet;
    const weapon = state.uwep;
    const primaryRing = state.u.rightHanded === false ? state.uleft : state.uright;
    if (weapon && isWeldedPrimary(weapon, state)
        && (ring === primaryRing || OBJECT_BIMANUAL[weapon.otyp]))
        return weapon;
    if (state.uarmg?.cursed)
        return state.uarmg;
    if (ring.cursed)
        return ring;
    return state.uarmg && (state.u.glibTurns ?? 0) > 0 ? state.uarmg : null;
}
export async function wearHeroAccessory(object, slot, state = game) {
    const position = ACCESSORY_SLOTS.find(position => position.slot === slot);
    if (!object || !position)
        return null;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property === 'levitation' || property === 'protectionFromShapeChangers')
        requireLiveGame(state);
    const previousLevitation = captureLevitationState(state);
    const wasStealthy = propertyIsActive('stealth', state);
    const wasFlying = !!state.u.flying;
    const wasInGas = property === 'magicalBreathing' && heroIsInDangerousRegion(state);
    await releaseWeaponSlots(object, state);
    const previous = state[slot] || state.u[slot];
    if (previous && previous !== object)
        cancelSlotTakeoff(slot, state);
    state[slot] = object;
    state.u[slot] = object;
    object.worn = true;
    object.wornSlot = position.label;
    object.owornmask = (object.owornmask ?? 0) | position.mask;
    if (property)
        grantWornProperty(property, object, slot, state);
    if (slot !== 'uamul')
        changeRingBonus(object, 1, state);
    if (slot === 'uamul')
        await applyAmuletOnEffects(object, state, { wasFlying, wasInGas });
    if (property === 'protectionFromShapeChangers')
        await restoreNaturalMonsterShapes(state);
    if (property === 'stealth' && !wasStealthy && propertyIsActive('stealth', state)) {
        learnRing(object, true, state);
        await plineWithContinuation('You move very quietly.');
    }
    if (property === 'levitation') {
        if (!previousLevitation.hasSource && !previousLevitation.blockedByTerrain) {
            await floatHeroUp(state, previousLevitation);
            learnRing(object, true, state);
            if (propertyIsActive('levitation', state))
                await applyHeroLocationEffects(undefined, { pick: false });
        }
        else
            refreshMovementProperties(state);
    }
    return property || null;
}
async function showWornAmulet(object, state) {
    const message = objectWearMessage(object, state);
    if (message)
        await plineWithContinuation(message);
}
async function applyAmuletOnEffects(object, state, { wasFlying, wasInGas }) {
    if (object.otyp === AMULET_OF_CHANGE) {
        await changeSexFromAmulet(object, state);
        return;
    }
    let message;
    if (object.otyp === AMULET_OF_UNCHANGING && heroIsSliming(state))
        clearHeroSliming(state);
    else if (object.otyp === AMULET_OF_RESTFUL_SLEEP) {
        const timeout = rnd(98) + 2;
        const previous = state.u._sleepyTimeout || 0;
        if (!previous || timeout < previous)
            state.u._sleepyTimeout = timeout;
    }
    else if (object.otyp === AMULET_OF_STRANGULATION) {
        if (startAmuletStrangulation(state))
            message = 'It constricts your throat!';
    }
    else if (OBJECT_PROPERTY[object.otyp] === 'magicalBreathing' && wasInGas) {
        learnObjectType(object.otyp, state);
        message = 'You are no longer bothered by the poison gas.';
    }
    else if (OBJECT_PROPERTY[object.otyp] === 'flying' && state.u.flying && !wasFlying) {
        learnObjectType(object.otyp, state);
        message = 'You are now in flight.';
    }
    else if (object.otyp === AMULET_OF_GUARDING) {
        learnObjectType(object.otyp, state);
        findArmorClass(state);
    }
    await showWornAmulet(object, state);
    if (message)
        await plineWithContinuation(message);
}
async function changeSexFromAmulet(object, state) {
    const original = heroPolyGender(state);
    if (!heroIsUnchanging(state))
        changeHeroSex(state);
    const changed = heroPolyGender(state) !== original;
    if (changed)
        learnObjectType(AMULET_OF_CHANGE, state);
    await showWornAmulet(object, state);
    if (changed) {
        newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`You are suddenly very ${state.flags.female ? 'feminine' : 'masculine'}!`);
    }
    else
        await plineWithContinuation("You don't feel like yourself.");
    if (changed && !Upolyd(state.u)) {
        const role = state.urole;
        const level = state.u.ulevel;
        if (!role || level === undefined)
            throw new Error('Amulet transformation requires the hero role and experience level');
        const rankIndex = experienceRankIndex(level);
        const rank = role.title[rankIndex];
        if (!rank)
            throw new Error(`Role ${role.key} has no title for rank ${rankIndex}`);
        const before = original === 1 ? 'f' : 'm';
        const after = state.flags.female ? 'f' : 'm';
        const title = role.name[before] !== role.name[after] ? role.name[after]
            : rank[before] !== rank[after] ? rank[after]
                : `${state.flags.female ? 'female' : 'male'} ${rank[after]}`;
        recordGameLogEvent(`transformed into ${withIndefiniteArticle(title)}`, { state });
    }
    await plineWithContinuation('The amulet disintegrates!');
    if (!changed && object.dknown)
        await tryCallObjectType(object, state);
    await consumeInventoryItem(object, state);
}
export async function removeHeroAccessory(object, state = game) {
    const objectProperty = OBJECT_PROPERTY[object.otyp];
    if (objectProperty === 'levitation' || objectProperty === 'protectionFromShapeChangers')
        requireLiveGame(state);
    const previousLevitation = captureLevitationState(state);
    const wasStealthy = propertyIsActive('stealth', state);
    const property = clearHeroAccessory(object, state);
    if (property === 'stealth' && wasStealthy && !propertyIsActive('stealth', state)) {
        learnRing(object, true, state);
        const steed = state.u.usteed;
        await plineWithContinuation(steed
            ? `You and ${monsterName(steed, { state, article: 'your', exact: true })} are noisy.`
            : 'You sure are noisy.');
    }
    if (property === 'protectionFromShapeChangers'
        && !propertyIsActive('protectionFromShapeChangers', state))
        await restartMonsterShapechanging(state);
    if (property === 'levitation') {
        if (!previousLevitation.blockedByTerrain) {
            await floatHeroDown(0, 0, state, previousLevitation);
            if (state.program_state.gameover)
                return property;
            if (!propertyIsActive('levitation', state))
                learnRing(object, true, state);
        }
        else
            refreshMovementProperties(state);
    }
    return property;
}
// C setworn/setnotworn: remove the source without running Ring_off().
export function clearHeroAccessory(object, state = game) {
    const position = ACCESSORY_SLOTS.find(({ slot }) => state[slot] === object || state.u[slot] === object);
    if (!position)
        return null;
    const { slot } = position;
    cancelSlotTakeoff(slot, state);
    state[slot] = null;
    state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~position.mask;
    const property = OBJECT_PROPERTY[object.otyp];
    if (property)
        removeWornProperty(property, object, slot, state);
    if (slot !== 'uamul')
        changeRingBonus(object, -1, state);
    if (object.otyp === AMULET_OF_STRANGULATION && heroIsStrangled(state)) {
        clearHeroStrangulation(state);
    }
    return property || null;
}
function changeRingBonus(ring, direction, state) {
    const attribute = RING_ATTRIBUTES.get(ring.otyp);
    if (attribute !== undefined) {
        const before = currentAttribute(attribute, state);
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[attribute] += direction * ring.spe;
        const observable = before !== currentAttribute(attribute, state);
        if (observable || !attributeIsAtLimit(attribute, state))
            learnRing(ring, observable, state);
    }
    else if (ring.otyp === RIN_INCREASE_ACCURACY) {
        state.u.uhitinc = (state.u.uhitinc || 0) + direction * ring.spe;
    }
    else if (ring.otyp === RIN_INCREASE_DAMAGE) {
        state.u.udaminc = (state.u.udaminc || 0) + direction * ring.spe;
    }
    else if (ring.otyp === RIN_PROTECTION) {
        learnRing(ring, ring.spe !== 0, state);
        if (ring.spe)
            findArmorClass(state);
    }
}
function learnRing(ring, observable, state) {
    if (observable) {
        if (objectTypeKnown(ring, state)) {
            if (!heroIsBlind(state))
                ring.dknown = true;
        }
        else if (ring.dknown) {
            learnObjectType(ring.otyp, state);
        }
    }
    if (ring.dknown && objectTypeKnown(ring, state) && OBJECT_CHARGED[ring.otyp])
        ring.known = true;
}
//# sourceMappingURL=accessory.js.map