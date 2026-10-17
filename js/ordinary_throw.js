// Hero throws which do not have a class-specific effect.
// C refs: dothrow.c throwit() and thitmonst(), zap.c bhit().
import { game, requirePlayingGame } from './gstate.js';
import { A_DEX, AKLYS_LIM, Is_airlevel, W_QUIVER, W_SWAPWEP, W_WEP } from './const.js';
import { exerciseAttribute } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { flyBoomerang } from './boomerang.js';
import { flush_screen, plineWithContinuation } from './display.js';
import { hitMonsterWithThrownEggPieOrVenom, } from './hero_thrown_egg_pie_venom.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { hurtleHero } from './hero_hurtle.js';
import { monsterProjectileDisplay } from './monster_projectile_display.js';
import { tossObjectUp } from './toss_up.js';
import { hitFloorWithObject } from './object_drop.js';
import { AKLYS, BOOMERANG } from './object_data.js';
import { rejoinObjectStack } from './object_stack.js';
import { definiteName, objectName, observeObjectForNaming } from './objnam.js';
import { propertyIsActive } from './properties.js';
import { finishReturningThrow, isAutoReturningThrow, throwerIsImpaired } from './returning_throw.js';
import { ceilingName } from './terrain_name.js';
import { addInventoryItemBefore } from './u_init.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat, } from './weapon_slots.js';
import { isThrowingWeapon, launcherMatchesAmmo, } from './object_properties.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, snuffThrownCandle, } from './thrown_object.js';
export async function throwOrdinaryObject({ state = game, item, quantity, splitObjectId = null, dx, dy, volley, }) {
    requirePlayingGame(state);
    const weaponMask = item.owornmask ?? 0;
    const twoWeapons = !!state.u.twoweap;
    const oldSlot = state.inventory[state.inventory.indexOf(item) + 1] ?? null;
    const thrown = await detachThrownUnit(state, item, quantity, splitObjectId);
    let tetherDisplay = null;
    try {
        if (state.program_state?.gameover)
            return { heroDied: true };
        const impaired = throwerIsImpaired(state);
        const returns = isAutoReturningThrow(thrown, weaponMask, state);
        const tethered = thrown.otyp === AKLYS && !!(weaponMask & W_WEP);
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
            if (state.u.dz < 0 && returns && !impaired && !slipped) {
                observeObjectForNaming(thrown, { state });
                const subject = definiteName(objectName(thrown, state), state);
                await plineWithContinuation(`${subject.charAt(0).toUpperCase() + subject.slice(1)} hits the ${ceilingName(state.u.ux, state.u.uy, state)} and returns to your hand!`);
                const returned = await returnThrowToInventory(thrown, weaponMask, twoWeapons, oldSlot, state);
                return { object: thrown, landed: returned, stoppedBy: 'vertical' };
            }
            const landed = state.u.dz < 0
                ? await tossObjectUp(thrown, { state })
                : await hitFloorWithObject(thrown, { state });
            if (state.program_state.gameover)
                return { heroDied: true };
            return { object: thrown, landed, stoppedBy: 'vertical' };
        }
        const boomerang = thrown.otyp === BOOMERANG
            && !state.underwater && !state.u.uinwater;
        if (boomerang && (Is_airlevel(state.u.uz) || propertyIsActive('levitation', state)))
            await hurtleHero(-actualDx, -actualDy, 1, { verbose: true });
        if (state.program_state.gameover)
            return { heroDied: true };
        const trajectory = heroThrowTrajectory(thrown, state, state.uwep);
        const range = state.underwater || state.u.uinwater ? 1
            : tethered ? Math.min(trajectory.range, AKLYS_LIM) : trajectory.range;
        if (tethered) {
            // The tether stays visible through contact and is erased by the
            // return roll, rather than by bhit()'s ordinary flight cleanup.
            tetherDisplay = monsterProjectileDisplay(thrown, state, { tethered: true });
            await flush_screen(0);
        }
        const flight = boomerang
            ? await flyBoomerang(thrown, actualDx, actualDy, state, volley)
            : await flyHeroThrownObject({
                state,
                object: thrown,
                dx: actualDx,
                dy: actualDy,
                range,
                ...(tetherDisplay ? { display: tetherDisplay }
                    : { captureFlight: captureThrownObjectFlight }),
            });
        if ('heroDied' in flight && flight.heroDied)
            return { heroDied: true };
        if ('caught' in flight && flight.caught) {
            await exerciseAttribute(A_DEX, true, state);
            const returned = await returnThrowToInventory(thrown, weaponMask, twoWeapons, oldSlot, state);
            return { ...flight, object: thrown, landed: returned };
        }
        if ('consumed' in flight && flight.consumed)
            return { ...flight, consumed: true };
        // bhit() erases a web-stopped returning missile before throwit() recoils.
        if (flight.stoppedBy === 'web')
            tetherDisplay?.clear();
        if (!boomerang && trajectory.recoil) {
            await hurtleHero(-actualDx, -actualDy, trajectory.recoil, { verbose: true });
            if (state.program_state.gameover)
                return { heroDied: true };
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
        if (!boomerang && returns && flight.stoppedBy !== 'web'
            && await finishReturningThrow({
                state, object: thrown, impact: flight, impaired: impaired || slipped,
                twoWeapons, oldSlot, tetherDisplay,
            })) {
            if (state.program_state.gameover)
                return { heroDied: true };
            return { ...flight, object: thrown, landed: thrown.where === 'inventory' ? thrown : null };
        }
        tetherDisplay?.clear();
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
        tetherDisplay?.clear();
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// C return_throw_to_inv(): first rejoin the original stack, otherwise add
// without merging and restore the equipment slots removed for this throw.
async function returnThrowToInventory(object, weaponMask, twoWeapons, oldSlot, state) {
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
        if (joined) {
            await reportHeroEncumbrance(state);
            return joined;
        }
        state.inventory.splice(state.inventory.indexOf(object), 1);
        object.where = 'free';
    }
    object.nomerge = true;
    const returned = await addInventoryItemBefore(object, oldSlot);
    returned.nomerge = false;
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
    await reportHeroEncumbrance(state);
    return returned;
}
//# sourceMappingURL=ordinary_throw.js.map