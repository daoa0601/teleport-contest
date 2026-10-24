// C hack.c:dosinkfall(): the hero levitates or flies onto a sink square and
// comes down.  The location-effects boundary calls this after pooleffects
// and before trap handling (C spoteffects(): IS_SINK && Levitation).
import { observeObjectForNaming } from './objnam.js';
import { A_CON, A_DEX, I_SPECIAL, TIMEOUT, W_ARTI } from './const.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { armorOffMessage, removeHeroArmor, stopDonning } from './armor.js';
import { removeHeroAccessory } from './accessory.js';
import { game, requireLiveGame } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { floorObjectDescription } from './floor_object_display.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroDeath } from './end.js';
import { LEVITATION_BOOTS, OBJECT_NAMES, OBJECT_SUBTYPE } from './object_data.js';
import { captureLevitationState, clearLevitationMasks, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty, refreshMovementProperties, refreshProperty, restoreLevitationSources, stashLevitationSources, } from './properties.js';
import { rn1, rnd } from './rng.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
const FELL_ON_SINK = 'fell onto a sink';
function wornAt(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}
// C HFlying || EFlying: the hero's own flight sources before the Flying
// macro applies the blocked mask or a flying steed.  A steed therefore does
// not prevent the fall, and neither does flight overridden by levitation.
function heroHasOwnFlight(state) {
    return hasIntrinsicProperty('flying', null, state)
        || hasWornProperty('flying', state)
        || hasInvokedProperty('flying', state)
        || (state.u.flyingTurns ?? 0) > 0;
}
// C Maybe_Half_Phys().
function maybeHalfPhysicalDamage(amount, state) {
    const hero = state.u;
    return hero.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}
function isWeaponOrWeaponTool(object) {
    return object.oclass === 2
        || (object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0);
}
export async function fallIntoSink(state = game, { publish = plineWithContinuation, die = finishHeroDeath } = {}) {
    // World side effects are singleton-only: every production caller uses
    // the live game, so a stale fixture must fail before any source stash.
    requireLiveGame(state);
    const hero = state.u;
    let levBoots = wornAt('uarmf', state)?.otyp === LEVITATION_BOOTS;
    // innate_lev: HLevitation & (FROMOUTSIDE | FROMFORM).  Timeout and the
    // blessed-potion at-will flag do not count.
    const innateLev = hasIntrinsicProperty('levitation', 'outside', state)
        || hasIntrinsicProperty('levitation', 'form', state);
    // blockd_lev: BLevitation == I_SPECIAL, a floor-trap hold on live
    // levitation sources (buried iron ball), not solid terrain.
    const levitation = captureLevitationState(state);
    const blockdLev = levitation.blockedByTrap
        && !levitation.blockedByTerrain;
    const ufall = !innateLev && !blockdLev && !heroHasOwnFlight(state);
    if (!ufall) {
        await publish(innateLev || blockdLev
            ? 'You wobble unsteadily for a moment.'
            : 'You gain control of your flight.');
    }
    else {
        // Fake removal of levitation in advance so that final disclosure
        // will be right if the crash is fatal; the worn items really stay
        // equipped until the forced removal below (C save/zero/restore).
        const stash = stashLevitationSources(state, { clear: true });
        await publish('You crash to the floor!');
        const damage = rn1(8, 25 - currentAttribute(A_CON, state));
        if (await loseHeroHp(maybeHalfPhysicalDamage(damage, state), FELL_ON_SINK, { state, publish, die }))
            return { fell: true, died: true };
        await exerciseAttribute(A_DEX, false, state);
        const touch = await selfTouchPetrifyingWeapons({
            messageStart: 'Falling, you', state, publish, die,
        });
        if (touch.died)
            return { fell: true, died: true };
        const pile = state.level?.objects?.[hero.ux]?.[hero.uy] || [];
        for (const object of pile) {
            if (!isWeaponOrWeaponTool(object))
                continue;
            observeObjectForNaming(object, { state });
            await publish(`You fell on ${await floorObjectDescription(object)}.`);
            if (await loseHeroHp(maybeHalfPhysicalDamage(rnd(3), state), FELL_ON_SINK, { state, publish, die })) {
                return { fell: true, died: true };
            }
            await exerciseAttribute(A_CON, false, state);
        }
        restoreLevitationSources(stash, state);
    }
    // Interrupt multi-turn donning/doffing when the hero fell, or when the
    // removal below will take levitation boots off an still-floating hero.
    if (ufall || levBoots) {
        await stopDonning(levBoots ? wornAt('uarmf', state) : null, state);
        // stopDonning() may have unworn partially-donned boots.
        levBoots = wornAt('uarmf', state)?.otyp === LEVITATION_BOOTS;
    }
    // Remove worn levitation items: invoked artifact, at-will origin and
    // timeout first, then a one-turn timeout keeps Levitation true so the
    // forced Ring_off()/Boots_off() transitions skip float_down().
    clearLevitationMasks(I_SPECIAL | TIMEOUT, W_ARTI, state);
    hero.levitationTurns = 1; // C HLevitation++
    refreshProperty('levitation', state);
    const left = wornAt('uleft', state);
    if (left?.otyp === RIN_LEVITATION) {
        await removeHeroAccessory(left, state);
        const message = await armorOffMessage(left, state);
        if (message)
            await publish(message);
    }
    const right = wornAt('uright', state);
    if (right?.otyp === RIN_LEVITATION) {
        await removeHeroAccessory(right, state);
        const message = await armorOffMessage(right, state);
        if (message)
            await publish(message);
    }
    if (levBoots) {
        const boots = wornAt('uarmf', state);
        if (!boots)
            throw new Error('The levitation boots disappeared before forced removal');
        await removeHeroArmor(boots, state);
        const message = await armorOffMessage(boots, state);
        if (message)
            await publish(message);
    }
    hero.levitationTurns = 0; // C HLevitation--
    refreshProperty('levitation', state);
    refreshMovementProperties(state); // C float_vs_flight()
    state.context.botl = true;
    return { fell: ufall, died: false };
}
//# sourceMappingURL=sink_fall.js.map