// Hero throws which do not have a class-specific effect.
// C refs: dothrow.c throwit() and thitmonst(), zap.c bhit().
import { game } from './gstate.js';
import { artifactById } from './artifacts.js';
import { W_QUIVER, W_SWAPWEP, W_WEP } from './const.js';
import { plineWithContinuation } from './display.js';
import { hitMonsterWithThrownEggPieOrVenom, } from './hero_thrown_egg_pie_venom.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { hurtleHero } from './hero_hurtle.js';
import { tossObjectUp } from './toss_up.js';
import { hitFloorWithObject } from './object_drop.js';
import { AKLYS, BOOMERANG } from './object_data.js';
import { rejoinObjectStack } from './object_stack.js';
import { definiteName, objectName, observeObjectForNaming } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { ceilingName } from './terrain_name.js';
import { addInventoryItem } from './u_init.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat, } from './weapon_slots.js';
import { isThrowingWeapon, launcherMatchesAmmo, } from './object_properties.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, snuffThrownCandle, } from './thrown_object.js';
export async function throwOrdinaryObject({ state = game, item, quantity, splitObjectId = null, dx, dy, volley, }) {
    const weaponMask = item.owornmask ?? 0;
    const twoWeapons = !!state.u.twoweap;
    const oldSlot = state.inventory[state.inventory.indexOf(item) + 1] ?? null;
    const thrown = await detachThrownUnit(state, item, quantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return { heroDied: true };
        const impaired = heroIsBlind(state) || heroIsHallucinating(state)
            || state.u.confused || propertyIsActive('confusion', state)
            || state.u.stunned || propertyIsActive('stunned', state)
            || state.u.fumbling || propertyIsActive('fumbling', state);
        const slipped = await applyThrowSlip({
            state,
            object: thrown,
            launcher: launcherMatchesAmmo(thrown, state.uwep),
            throwingWeapon: isThrowingWeapon(thrown),
        });
        await applyLowStaminaThrow({ state, object: thrown });
        const actualDx = state.u.dx ?? dx;
        const actualDy = state.u.dy ?? dy;
        if (state.u.dz) {
            const returns = thrown.otyp === BOOMERANG
                || !!(weaponMask & W_WEP) && (thrown.otyp === AKLYS
                    || artifactById(thrown.oartifact, state)?.name === 'Mjollnir'
                        && state.urole?.key === 'valkyrie');
            if (state.u.dz < 0 && returns && !impaired && !slipped) {
                observeObjectForNaming(thrown, { state });
                const subject = definiteName(objectName(thrown, state), state);
                await plineWithContinuation(`${subject.charAt(0).toUpperCase() + subject.slice(1)} hits the ${ceilingName(state.u.ux, state.u.uy, state)} and returns to your hand!`);
                const returned = await returnUpwardThrowToInventory(thrown, weaponMask, twoWeapons, oldSlot, state);
                return { object: thrown, landed: returned, stoppedBy: 'vertical' };
            }
            const landed = state.u.dz < 0
                ? await tossObjectUp(thrown, { state })
                : await hitFloorWithObject(thrown, { state });
            if (state.program_state.gameover)
                return { heroDied: true };
            return { object: thrown, landed, stoppedBy: 'vertical' };
        }
        const trajectory = heroThrowTrajectory(thrown, state, state.uwep);
        const flight = await flyHeroThrownObject({
            state,
            object: thrown,
            dx: actualDx,
            dy: actualDy,
            range: trajectory.range,
            captureFlight: captureThrownObjectFlight,
        });
        if (trajectory.recoil) {
            await hurtleHero(-actualDx, -actualDy, trajectory.recoil, { verbose: true });
        }
        if (flight.destroyed || flight.migrated)
            return flight;
        if (flight.contact) {
            await snuffThrownCandle(thrown, state);
            const eggPieOrVenom = await hitMonsterWithThrownEggPieOrVenom(flight.contact, thrown, { state, target: { x: flight.x, y: flight.y } });
            if (eggPieOrVenom?.heroDied)
                return eggPieOrVenom;
            if (eggPieOrVenom?.consumed)
                return { ...flight, consumed: true };
            if (!eggPieOrVenom) {
                const contact = await hitMonsterWithThrownObject(flight.contact, thrown, {
                    state, target: { x: flight.x, y: flight.y },
                    ...(volley ? { volley } : {}),
                });
                if (contact.heroDied)
                    return contact;
                if (contact.consumed)
                    return { ...flight, consumed: true };
            }
        }
        const landed = await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: flight.x,
            y: flight.y,
            contactedMonster: flight.contact,
        });
        return { ...flight, object: thrown, landed };
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// C return_throw_to_inv(): first rejoin the original stack, otherwise add
// without merging and restore the equipment slots removed for this throw.
async function returnUpwardThrowToInventory(object, weaponMask, twoWeapons, oldSlot, state) {
    const split = state.context.objsplit;
    const siblingId = object.o_id === split?.child_oid ? split.parent_oid
        : object.o_id === split?.parent_oid ? split.child_oid : null;
    const sibling = state.inventory.find(item => item.o_id === siblingId);
    if (sibling) {
        state.inventory.unshift(object);
        object.where = 'inventory';
        const parent = object.o_id === split?.parent_oid ? object : sibling;
        const child = parent === object ? sibling : object;
        const joined = await rejoinObjectStack(parent, child, state);
        if (joined)
            return joined;
        state.inventory.splice(state.inventory.indexOf(object), 1);
        object.where = 'free';
    }
    object.nomerge = true;
    const returned = await addInventoryItem(object);
    returned.nomerge = false;
    if (state.flags.fixinv === false) {
        state.inventory.splice(state.inventory.indexOf(returned), 1);
        const index = oldSlot ? state.inventory.indexOf(oldSlot) : -1;
        state.inventory.splice(index >= 0 ? index : state.inventory.length, 0, returned);
    }
    const quivered = !!((returned.owornmask ?? 0) & W_QUIVER);
    const held = !!(((returned.owornmask ?? 0) | weaponMask) & (W_WEP | W_SWAPWEP));
    if (quivered && held)
        await setQuiverObject(null, state);
    if (weaponMask & W_WEP && !state.uwep)
        await setPrimaryWeapon(returned, state);
    else if (weaponMask & W_SWAPWEP && !state.uswapwep)
        await setSecondaryWeapon(returned, state);
    else if (weaponMask & W_QUIVER && !state.uquiver)
        await setQuiverObject(returned, state);
    if (twoWeapons && !state.u.twoweap)
        setTwoWeaponCombat(true, state);
    return returned;
}
//# sourceMappingURL=ordinary_throw.js.map