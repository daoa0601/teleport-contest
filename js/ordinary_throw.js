// Hero throws which do not have a class-specific effect.
// C refs: dothrow.c throwit() and thitmonst(), zap.c bhit().
import { game } from './gstate.js';
import { hitMonsterWithThrownEggPieOrVenom, } from './hero_thrown_egg_pie_venom.js';
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { hurtleHero } from './hero_hurtle.js';
import { isThrowingWeapon, launcherMatchesAmmo, } from './object_properties.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, snuffThrownCandle, } from './thrown_object.js';
export async function throwOrdinaryObject({ state = game, item, quantity, splitObjectId = null, dx, dy, volley, }) {
    const thrown = await detachThrownUnit(state, item, quantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return { heroDied: true };
        await applyThrowSlip({
            state,
            object: thrown,
            launcher: launcherMatchesAmmo(thrown, state.uwep),
            throwingWeapon: isThrowingWeapon(thrown),
        });
        await applyLowStaminaThrow({ state, object: thrown });
        const actualDx = state.u.dx ?? dx;
        const actualDy = state.u.dy ?? dy;
        if (state.u.dz) {
            const landed = await finishHeroThrownObjectLanding({
                state,
                object: thrown,
                x: state.u.ux,
                y: state.u.uy,
            });
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
//# sourceMappingURL=ordinary_throw.js.map