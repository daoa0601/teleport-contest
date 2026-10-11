// Thrown-object contact while the hero is engulfed.
// C refs: dothrow.c throw_obj(), throwit(), thitmonst(), swallowit();
// steal.c mpickobj().
import { hitMonsterWithThrownEggPieOrVenom, isHeroThrownEggPieOrVenom, } from './hero_thrown_egg_pie_venom.js';
import { plineWithContinuation } from './display.js';
import { foodObjectName, objectName, observeObjectForNaming } from './objnam.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { monsterAtPosition } from './monster_location.js';
import { monsterName } from './monster_name.js';
import { petrifyMonsterImmediately } from './monster_stoning.js';
import { delobj } from './object_delete.js';
import { BOULDER, BRASS_LANTERN, CORPSE, MAGIC_LAMP, OBJECT_SUBTYPE, OIL_LAMP, } from './object_data.js';
import { MONSTER_SYMBOL, monsterCanEngulf, monsterDigests, monsterIsAnimal, monsterIsWhirly, monsterTypeName, } from './monster_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from './object_timers.js';
import { isThrowingWeapon, launcherMatchesAmmo, } from './object_properties.js';
import { rnd } from './rng.js';
import { hitMonsterWithSupportedPotion, SUPPORTED_MONSTER_POTION_TYPES, } from './potion_hit.js';
import { heroIsBlind } from './senses.js';
import { touchPetrifies } from './stoning.js';
import { offerThrownFood } from './thrown_food.js';
import { detachThrownUnit, finishHeroThrownObjectLanding, prepareHeroThrownTarget } from './thrown_object.js';
import { applyLowStaminaThrow, applyThrowSlip, } from './throw_state.js';
const PM_AIR_ELEMENTAL = 154;
const POTION_CLASS = 8;
const TIMED_LAMP_TYPES = new Set([BRASS_LANTERN, OIL_LAMP]);
const LAMP_TYPES = new Set([...TIMED_LAMP_TYPES, MAGIC_LAMP]);
const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];
function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
function itemIsEquipped(state, item) {
    return EQUIPMENT_SLOTS.some(slot => state[slot] === item || state.u?.[slot] === item)
        || !!(item.owornmask ?? 0);
}
function supportedLitLamp(state, item, engulfer) {
    if (!item.lamplit)
        return true;
    if (!LAMP_TYPES.has(item.otyp) || item.artifact || item.oartifact
        || !monsterCanEngulf(engulfer))
        return false;
    const timers = objectTimers(item);
    if (item.otyp === MAGIC_LAMP)
        return timers.length === 0;
    const timer = timers[0];
    return timers.length === 1 && timer !== undefined
        && timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT
        && Number.isFinite(timer.deadline)
        && timer.deadline >= state.moves;
}
function swallowedWeaponTarget(state, item, objectClass) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer)
        return null;
    const subtype = OBJECT_SUBTYPE[item.otyp] ?? 0;
    const weaponOrTool = objectClass === 2
        || (objectClass === 6 && subtype !== 0);
    if (!weaponOrTool || engulfer.wormno) {
        return null;
    }
    return engulfer;
}
function genericSwallowedEligibility(state, item, objectClass, selectedQuantity) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer)
        return null;
    // Weapon/gem damage, effectful potions, balls, boulders,
    // eggs, venom,
    // shop objects, worn-state removal, unsupported burning objects, and
    // timed stack splitting own materially different continuations and
    // remain explicit successors.  The supported lamps below reuse the
    // live burn-timer owner after mpickobj() has linked monster ownership.
    if ([2, 8, 12, 13, 15, 17].includes(objectClass)
        || item.otyp === BOULDER
        || item === state.uball || item === state.u?.uball)
        return null;
    if (objectClass === 6 && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0)
        return null; // is_weptool()
    if (itemIsEquipped(state, item))
        return null;
    if (!supportedLitLamp(state, item, engulfer))
        return null;
    if (selectedQuantity > 1
        && ((item.timed ?? 0) > 0 || (item.objectTimers?.length ?? 0) > 0)) {
        return null;
    }
    return engulfer;
}
function swallowedPotionEligibility(state, item, objectClass, selectedQuantity) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1) {
        return null;
    }
    return engulfer;
}
export async function resolveSwallowedWeaponThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, finishKill, }) {
    const engulfer = swallowedWeaponTarget(state, item, objectClass);
    if (!engulfer)
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        const launched = launcherMatchesAmmo(thrown, state.uwep);
        await applyThrowSlip({
            state,
            object: thrown,
            launcher: launched,
            throwingWeapon: isThrowingWeapon(thrown),
        });
        await applyLowStaminaThrow({ state, object: thrown });
        const impactX = engulfer.mx, impactY = engulfer.my;
        const contact = await hitMonsterWithThrownObject(engulfer, thrown, {
            state,
            guaranteedHit: true,
            finishKillWithObject: finishKill,
        });
        if (contact.heroDied)
            return true;
        if (!contact.consumed) {
            if (state.u.uswallow) {
                const currentEngulfer = state.u.ustuck;
                if (!currentEngulfer)
                    throw new Error('A swallowed hero must have an engulfing monster.');
                await addObjectToMonsterInventory(currentEngulfer, thrown, state, { atFront: true });
            }
            else {
                await finishHeroThrownObjectLanding({
                    state, object: thrown, x: impactX, y: impactY,
                    contactedMonster: engulfer,
                });
                if (state.program_state.gameover)
                    return true;
            }
        }
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
export async function resolveSwallowedEggPieOrVenomThrow({ state = game, item, selectedQuantity, splitObjectId = null, finishKill, }) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || !isHeroThrownEggPieOrVenom(item))
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        const contact = await hitMonsterWithThrownEggPieOrVenom(engulfer, thrown, {
            state,
            guaranteedHit: true,
            finishMonsterKill: finishKill,
        });
        if (!contact)
            throw new Error('An eligible swallowed projectile had no contact result.');
        if (contact.heroDied)
            return true;
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
export async function resolveSwallowedPotionThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, wakeNearby, finishKill, }) {
    const engulfer = swallowedPotionEligibility(state, item, objectClass, selectedQuantity);
    if (!engulfer)
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        // throwit() evaluates its cursed/greased slip draw before thitmonst().
        // Potions only enter the displacement branch when greased, but a cursed
        // ungreased identity still consumes the rn2(7) gate.
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        rnd(20);
        const impact = await hitMonsterWithSupportedPotion({
            state,
            monster: engulfer,
            potion: thrown,
            wakeMonster,
            wakeNearby,
            finishKill,
            heroCaused: true,
            resolveVapor: true,
            distance: 0,
        });
        if (impact?.heroDied)
            return true;
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
export async function resolveSwallowedFoodThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, }) {
    const engulfer = state.u.uswallow ? state.u.ustuck : null;
    if (!engulfer || objectClass !== 7 || isHeroThrownEggPieOrVenom(item))
        return false;
    requireLiveGame(state);
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        const impactX = engulfer.mx, impactY = engulfer.my;
        prepareHeroThrownTarget(engulfer);
        rnd(20);
        const offer = await offerThrownFood(engulfer, thrown, state);
        if (offer?.heroDied)
            return true;
        if (offer?.handled) {
            state.context.move = 1;
            return true;
        }
        if (!offer) {
            const wake = await wakeMonster(engulfer);
            if (wake.heroDied)
                return true;
            if (thrown.otyp === CORPSE && thrown.corpsenm !== undefined
                && touchPetrifies(thrown.corpsenm) && monsterIsAnimal(engulfer)) {
                const stone = await petrifyMonsterImmediately(engulfer, {
                    creditHero: true,
                    finishDeath: (target, death = {}) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
                        ...death, showKillMessage: false, recordConduct: false,
                    }),
                });
                if (stone.heroDied)
                    return true;
                // The thrown corpse is still free while the statue is made.
                // Native deletes it after expulsion, so it cannot be recovered
                // from the statue or from the square beneath it.
                if (!state.u.uswallow) {
                    await delobj(thrown, state);
                    state.context.move = 1;
                    return true;
                }
            }
            const trail = monsterDigests(engulfer) ? ' entrails'
                : monsterIsWhirly(engulfer) ? ' currents' : '';
            const name = monsterName(engulfer, { state });
            observeObjectForNaming(thrown, { state });
            const foodName = foodObjectName(thrown, { state, definite: true });
            const subject = foodName.charAt(0).toUpperCase() + foodName.slice(1);
            await plineWithContinuation(`${subject} vanishes into ${trail ? possessive(name) : name}${trail}.`);
        }
        if (state.u.uswallow) {
            const currentEngulfer = state.u.ustuck;
            if (!currentEngulfer)
                throw new Error('A swallowed hero must have an engulfing monster.');
            await addObjectToMonsterInventory(currentEngulfer, thrown, state, { atFront: true });
        }
        else {
            // Taming can expel the hero and move the monster away from the
            // original impact cell. A rejected meal lands at that old cell.
            await finishHeroThrownObjectLanding({
                state, object: thrown, x: impactX, y: impactY,
                contactedMonster: monsterAtPosition(requireGameLevel(state), impactX, impactY),
            });
            if (state.program_state.gameover)
                return true;
        }
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
export async function resolveGenericSwallowedThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, }) {
    const engulfer = genericSwallowedEligibility(state, item, objectClass, selectedQuantity);
    if (!engulfer)
        return false;
    // freeinv() occurs before throwit() begins slip/contact handling.
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        rnd(20); // thitmonst() consumes dieroll before selecting this class arm
        const wake = await wakeMonster(engulfer);
        if (wake.heroDied)
            return true;
        const monsterName = engulfer.name
            || `the ${monsterTypeName(engulfer.mnum, !!engulfer.female)}`;
        const whirly = MONSTER_SYMBOL[engulfer.mnum] === 22
            || engulfer.mnum === PM_AIR_ELEMENTAL;
        const trail = monsterDigests(engulfer)
            ? ' entrails' : whirly ? ' currents' : '';
        const destination = trail
            ? `${possessive(monsterName)}${trail}` : monsterName;
        await plineWithContinuation(`The ${objectName(thrown, state)} vanishes into ${destination}.`);
        const snuffLamp = thrown.lamplit && LAMP_TYPES.has(thrown.otyp)
            && monsterCanEngulf(engulfer);
        if (snuffLamp && !heroIsBlind(state)) {
            await plineWithContinuation(`The ${objectName(thrown, state)} goes out.`);
        }
        await addObjectToMonsterInventory(engulfer, thrown, state, { atFront: true });
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
//# sourceMappingURL=swallowed_throw.js.map