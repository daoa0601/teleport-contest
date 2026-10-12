// C do_wear.c:doddoremarm(), select_off(), take_off(), do_takeoff().
import { removeHeroAccessory } from './accessory.js';
import { announceDisplacementLoss, armorOffMessage, armorSimpleName, findArmorClass, removeHeroArmor } from './armor.js';
import { heroFingerName, heroFootName, heroHandName, heroNeckName } from './body_parts.js';
import { Is_airlevel, TT_BEARTRAP, TT_INFLOOR, P_LONG_SWORD, P_SHORT_SWORD, P_BROAD_SWORD, P_SABER, P_TWO_HANDED_SWORD, } from './const.js';
import { displayLiquidName, plineWithContinuation as pline, see_monsters } from './display.js';
import { removeEyewear } from './eyewear.js';
import { game } from './gstate.js';
import { AMULET_OF_GUARDING, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, BATTLE_AXE, CORPSE, LENSES, OBJECT_BIMANUAL, OBJECT_DELAY, OBJECT_NAMES, OBJECT_SUBTYPE, } from './object_data.js';
import { MONSTER_NAME, monsterIsHumanoid } from './monster_data.js';
import { heroIsBreathless, heroSpecies } from './hero_species.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { hasIntrinsicProperty, propertyIsActive } from './properties.js';
import { learnObjectType } from './object_knowledge.js';
import { heroIsInDangerousRegion } from './regions.js';
import { heroCanSwim } from './hack.js';
import { applyHeroLiquidEffects, applyHeroLocationEffects } from './cmd.js';
import { isLavaAt, isPoolAt, levelIsWaterLevel } from './terrain_properties.js';
import { makePlural } from './object_grammar.js';
import { objectName } from './objnam.js';
import { heroFormFlags, heroHasNoLimbs } from './polyself.js';
import { paranoidQuery } from './query.js';
import { touchPetrifies } from './stoning.js';
import { surfaceName } from './terrain_name.js';
import { isWeldedPrimary, setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './weapon_slots.js';
import { TAKEOFF_ORDER, resetBulkTakeoff, takeoffSlotObject } from './takeoff_state.js';
import { selectBulkTakeoff } from './takeoff_menu.js';
const AMULET_OF_ESP = OBJECT_NAMES.indexOf('amulet of ESP');
const AMULET_OF_FLYING = OBJECT_NAMES.indexOf('amulet of flying');
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
export async function takeOffAll() {
    game.context.move = 0;
    const progress = game.context.takeoff;
    if (progress && (progress.current || progress.pending.length)) {
        await pline(`You continue ${progress.text}.`);
        game._occupation = { key: 'takeoff', text: progress.text };
        return;
    }
    if (!TAKEOFF_ORDER.some(slot => takeoffSlotObject(slot))) {
        await pline('You are not wearing anything.');
        return;
    }
    const selected = new Set();
    await selectBulkTakeoff(async (object) => {
        const slot = TAKEOFF_ORDER.find(slot => takeoffSlotObject(slot) === object);
        if (slot && await canSelectOff(object, slot))
            selected.add(slot);
    });
    if (!selected.size)
        return;
    const pending = TAKEOFF_ORDER.filter(slot => selected.has(slot));
    const text = pending.some(slot => !['uwep', 'uswapwep', 'uquiver'].includes(slot))
        ? 'disrobing' : 'disarming';
    game.context.takeoff = { pending, current: null, delay: 0, text };
    await continueBulkTakeoff();
}
// The initiating command schedules work; each later callback completes one
// working turn. Even zero-delay armor requires one such turn in native 'A'.
export async function continueBulkTakeoff(state = game) {
    const progress = state.context.takeoff;
    if (!progress)
        return false;
    if (progress.current) {
        if (progress.delay > 0) {
            progress.delay--;
            return true;
        }
        const slot = progress.current;
        await removeSelectedSlot(slot, state);
        progress.pending = progress.pending.filter(candidate => candidate !== slot);
        progress.current = null;
        if (state.program_state.gameover)
            return false;
    }
    const slot = progress.pending[0];
    progress.delay = 0;
    if (!slot) {
        await pline(`You finish ${progress.text}.`);
        resetBulkTakeoff(state);
        return false;
    }
    progress.current = slot;
    progress.delay = Math.max(0, removalDelay(slot, state) - 1);
    state._occupation = { key: 'takeoff', text: progress.text };
    return true;
}
function removalDelay(slot, state) {
    const object = takeoffSlotObject(slot, state);
    const armor = ['uarm', 'uarmc', 'uarmh', 'uarmg', 'uarms', 'uarmu', 'uarmf'].includes(slot);
    let delay = armor && object ? OBJECT_DELAY[object.otyp] ?? 0 : 1;
    const cloak = takeoffSlotObject('uarmc', state);
    const suit = takeoffSlotObject('uarm', state);
    if ((slot === 'uarm' || slot === 'uarmu') && cloak)
        delay += 2 * (OBJECT_DELAY[cloak.otyp] ?? 0) + 1;
    if (slot === 'uarmu' && suit)
        delay += 2 * (OBJECT_DELAY[suit.otyp] ?? 0);
    return delay;
}
async function removeSelectedSlot(slot, state) {
    const object = takeoffSlotObject(slot, state);
    if (!object)
        return;
    if (slot === 'uswapwep') {
        const twoweap = state.u.twoweap;
        await setSecondaryWeapon(null, state);
        await pline(twoweap ? 'You are no longer wielding two weapons at once.'
            : 'You no longer have a second weapon readied.');
        return;
    }
    if (slot === 'uquiver') {
        await setQuiverObject(null, state);
        await pline('You no longer have ammunition readied.');
        return;
    }
    if (await unremovableCurse(object, slot, state)) {
        if (slot !== 'uwep' && slot !== 'ublindf')
            await offMessage(object, state);
        return;
    }
    if (slot === 'uwep') {
        const twoweap = state.u.twoweap;
        await setPrimaryWeapon(null, state);
        const hands = takeoffSlotObject('uarmg', state) ? 'empty handed'
            : monsterIsHumanoid(heroSpecies(state)) ? 'bare handed' : 'not wielding anything';
        await pline(twoweap ? 'You are no longer wielding either weapon.' : `You are ${hands}.`);
    }
    else if (slot === 'ublindf') {
        await removeEyewear(object, { state });
    }
    else if (slot === 'uamul') {
        await removeAmulet(object, state);
        // Native Amulet_off() supplies its own off_msg(); take_off() also
        // prints the returned object's off_msg(), including this second one.
        if (!state.program_state.gameover)
            await offMessage(object, state);
    }
    else if (slot === 'uleft' || slot === 'uright') {
        await removeHeroAccessory(object, state);
        if (!state.program_state.gameover)
            await offMessage(object, state);
    }
    else {
        // Native armor-off functions leave AC for allmain.c:find_ac(),
        // after the removal messages and the elapsed monster turns.
        await removeHeroArmor(object, state, { deferArmorClass: true });
        if (!state.program_state.gameover) {
            await announceDisplacementLoss(object, state);
            await offMessage(object, state);
        }
    }
}
async function removeAmulet(object, state) {
    const strangled = heroIsStrangled(state);
    const flying = propertyIsActive('flying', state);
    const guarding = object.otyp === AMULET_OF_GUARDING;
    // C Amulet_off() calculates guarding AC while the amulet is still worn.
    if (guarding)
        findArmorClass(state);
    await removeHeroAccessory(object, state);
    if (guarding)
        state._armorClassDirty = true;
    if (object.otyp === AMULET_OF_RESTFUL_SLEEP && !hasIntrinsicProperty('sleepy', null, state)
        && !state.u._propertySources?.sleepy?.worn.length
        && !state.u._propertySources?.sleepy?.carried.length) {
        state.u._sleepyTimeout = 0;
        state.u.sleepyTurns = 0;
    }
    await offMessage(object, state);
    if (object.otyp === AMULET_OF_ESP)
        await see_monsters();
    else if (object.otyp === AMULET_OF_STRANGULATION && strangled) {
        await pline(heroIsBreathless(state)
            ? `Your ${heroNeckName(state)} is no longer constricted!` : 'You can breathe more easily!');
        learnObjectType(object.otyp, state);
    }
    else if (object.otyp === AMULET_OF_MAGICAL_BREATHING) {
        // C cant_drown() tests the form, not remaining magical breathing.
        // drown() still runs for the warning and inventory water damage.
        if (state.u.uinwater && !(heroFormFlags(state) & (M1_AMPHIBIOUS | M1_BREATHLESS))
            && !heroCanSwim(state)) {
            await pline(`You suddenly inhale an unhealthy amount of ${displayLiquidName('water')}!`);
            await applyHeroLiquidEffects(undefined, { entry: 'drown' });
            if (state.program_state.gameover)
                return;
            learnObjectType(object.otyp, state);
        }
        if (heroIsInDangerousRegion(state)) {
            await pline('You are breathing poison gas!');
            learnObjectType(object.otyp, state);
        }
    }
    else if (object.otyp === AMULET_OF_FLYING && flying && !propertyIsActive('flying', state)) {
        const overLiquid = isPoolAt(state.u.ux, state.u.uy, state) || isLavaAt(state.u.ux, state.u.uy, state)
            || levelIsWaterLevel(state) || Is_airlevel(state.u.uz);
        await pline(overLiquid ? 'You stop flying.' : 'You land.');
        await applyHeroLocationEffects();
        if (state.program_state.gameover)
            return;
        learnObjectType(object.otyp, state);
    }
}
async function offMessage(object, state) {
    const message = armorOffMessage(object, state);
    if (message)
        await pline(message);
}
async function canSelectOff(object, slot) {
    const weapon = takeoffSlotObject('uwep');
    const gloves = takeoffSlotObject('uarmg');
    const cloak = takeoffSlotObject('uarmc');
    const suit = takeoffSlotObject('uarm');
    const slippery = !!game.u.glib || (game.u.glibTurns ?? 0) > 0;
    if (slot === 'uleft' || slot === 'uright') {
        if (heroHasNoLimbs(game)) {
            await pline('The ring is stuck.');
            return false;
        }
        const welded = checkWeldedWeapon(weapon);
        const primary = game.u.rightHanded === false ? 'uleft' : 'uright';
        if (welded && (slot === primary || !!weapon && !!OBJECT_BIMANUAL[weapon.otyp])) {
            await pline(`You cannot free a weapon ${heroHandName(game)} to remove the ring.`);
            return false;
        }
        if (gloves && (gloves.cursed || slippery)) {
            await pline(`You cannot take off your ${slippery ? 'slippery ' : ''}${armorSimpleName(gloves)} to remove the ring.`);
            if (!slippery)
                gloves.bknown = true;
            return false;
        }
    }
    if (slot === 'uarmg') {
        if (checkWeldedWeapon(weapon)) {
            await pline(`You are unable to take off your gloves while wielding that ${weaponNoun(weapon) === 'sword' ? 'sword' : 'weapon'}.`);
            return false;
        }
        if (slippery) {
            await pline(`${object.unpaid ? 'The' : 'Your'} ${armorSimpleName(object)} are too slippery to take off.`);
            return false;
        }
        const corpse = game.inventory.find(candidate => candidate.otyp === CORPSE && touchPetrifies(candidate.corpsenm));
        if (corpse && !await paranoidQuery(true, `Take off your ${armorSimpleName(object)} despite carrying a dead ${MONSTER_NAME[corpse.corpsenm ?? -1] || 'monster'}?`))
            return false;
    }
    if (slot === 'uarmf' && game.u.utrap) {
        if (game.u.utraptype === TT_BEARTRAP) {
            await pline(`The bear trap prevents you from pulling your ${heroFootName(game)} out.`);
            return false;
        }
        if (game.u.utraptype === TT_INFLOOR) {
            await pline(`You are stuck in the ${surfaceName(game.u.ux, game.u.uy)}, and cannot pull your ${makePlural(heroFootName(game))} out.`);
            return false;
        }
    }
    if (slot === 'uarm' || slot === 'uarmu') {
        const obstacle = cloak?.cursed ? cloak : slot === 'uarmu' && suit?.cursed ? suit
            : checkWeldedWeapon(weapon) && weapon && OBJECT_BIMANUAL[weapon.otyp] ? weapon : null;
        if (obstacle) {
            const action = obstacle === cloak ? `remove your ${armorSimpleName(obstacle)}`
                : obstacle === suit ? 'remove your suit' : `release your ${weaponNoun(obstacle)}`;
            await pline(`You cannot ${action} to take off the ${objectName(object)}.`);
            obstacle.bknown = true;
            return false;
        }
    }
    if (slot === 'uquiver' || slot === 'uswapwep' && !game.u.twoweap)
        return true;
    return !await unremovableCurse(object, slot, game);
}
function weaponNoun(object) {
    const skill = object ? OBJECT_SUBTYPE[object.otyp] : undefined;
    return skill !== undefined && [P_SHORT_SWORD, P_BROAD_SWORD, P_LONG_SWORD, P_TWO_HANDED_SWORD, P_SABER].includes(skill)
        ? 'sword' : object?.otyp === BATTLE_AXE ? 'axe' : 'weapon';
}
// C welded() reveals the curse even when the weapon does not block removal.
function checkWeldedWeapon(object, state = game) {
    if (!object || !isWeldedPrimary(object, state))
        return false;
    object.bknown = true;
    return true;
}
async function unremovableCurse(object, slot, state) {
    if (!(slot === 'uwep' ? checkWeldedWeapon(object, state) : object.cursed))
        return false;
    const slippery = !!state.u.glib || (state.u.glibTurns ?? 0) > 0;
    const gloves = takeoffSlotObject('uarmg', state);
    if (slippery && object.bknown && (gloves ? slot === 'uwep' : ['uwep', 'uleft', 'uright'].includes(slot))) {
        const fingers = gloves ? armorSimpleName(gloves, state) : makePlural(heroFingerName(state));
        await pline(`Despite your slippery ${fingers}, you can't.`);
    }
    else {
        const plural = slot === 'uarmf' || slot === 'uarmg' || object.otyp === LENSES || object.quan > 1;
        await pline(`You can't.  ${plural ? 'They are' : 'It is'} cursed.`);
    }
    object.bknown = true;
    return true;
}
//# sourceMappingURL=bulk_takeoff.js.map