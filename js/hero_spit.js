// The #monster spit command for a polymorphed hero.
// C refs: polyself.c dospit(), dothrow.c throwit()/thitmonst()/toss_up(),
// and uhitm.c hmon() venom cases.

import { heroCanBeBlindedByVenom } from './blinding_attack.js';
import { IS_SOFT, LOST_THROWN } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { hitMonsterWithThrownCreamOrVenom } from './hero_cream_and_venom.js';
import { hurtleHero } from './hero_hurtle.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { place_object, stack_object } from './floor_object.js';
import { mksobj } from './mklev.js';
import { levelHasCeiling } from './mon.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import {
    AD_ACID, AD_BLND, AD_DRST, AT_SPIT,
} from './monster_attack_types.js';
import {
    breakFloorObject, breakObjectAtLocation, objectBreaksOnImpact,
} from './object_breakage.js';
import {
    ACID_VENOM, BLINDING_VENOM,
} from './object_data.js';
import { heroMonsterForm } from './polyself.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, syncBlindness } from './senses.js';
import { surfaceName } from './terrain_name.js';
import {
    captureThrownObjectFlight, flyHeroThrownObject, heroThrowTrajectory,
} from './thrown_object.js';
import { promptDirection } from './tty_prompts.js';

export function heroSpitAttack(state = game) {
    const form = heroMonsterForm(state);
    if (form === null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType]) => attackType === AT_SPIT,
    ) || null;
}

function venomTypeForAttack(attack) {
    const damageType = attack?.[1];
    return damageType === AD_BLND || damageType === AD_DRST
        ? BLINDING_VENOM : ACID_VENOM;
}

function settleVenom(venom, x, y, state) {
    place_object(venom, x, y);
    stack_object(venom, state);
    newsym(x, y);
}

async function breakVenomAtEndpoint(
    venom, x, y, state, publish, random,
) {
    venom.ox = x;
    venom.oy = y;
    const location = state.level?.at?.(x, y);
    if (location && !IS_SOFT(location.typ))
        objectBreaksOnImpact(venom, random);
    return breakObjectAtLocation(venom, { state, publish, random });
}

async function dropVenomAtHero(venom, state, publish, random, verbose) {
    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const underwater = state.underwater || state.u?.uinwater;
    if (!location || IS_SOFT(location.typ) || underwater) {
        settleVenom(venom, x, y, state);
        return { destroyed: false };
    }

    venom.ox = x;
    venom.oy = y;
    if (verbose) {
        await publish(`A ${venom.name || 'splash of venom'} hits the ${
            surfaceName(x, y, state)}.`);
    }
    const result = await breakFloorObject(venom, {
        state, publish, random,
    });
    if (!result.destroyed) settleVenom(venom, x, y, state);
    return result;
}

async function tossVenomUp(venom, state, publish, random, rollOne) {
    const underwater = state.underwater || state.u?.uinwater;
    const hitsRoof = random(5) !== 0 && !underwater;
    const hasCeiling = levelHasCeiling(state);
    const ceiling = hasCeiling ? 'ceiling'
        : underwater ? 'water above' : 'sky';

    venom.ox = state.u.ux;
    venom.oy = state.u.uy;
    if (hasCeiling && hitsRoof && objectBreaksOnImpact(venom, random)) {
        await publish(`A splash of venom hits the ${ceiling}.`);
        return breakObjectAtLocation(venom, { state, publish, random });
    }

    const action = hasCeiling
        ? hitsRoof ? 'hits' : 'almost hits'
        : 'flies up into';
    await publish(
        `A splash of venom ${action} the ${ceiling}, then falls back on top of your head.`,
    );

    if (objectBreaksOnImpact(venom, random)) {
        const canBlind = venom.otyp === BLINDING_VENOM
            && heroCanBeBlindedByVenom(state);
        const blindIncrement = canBlind ? rollOne(25) : 0;
        const wasBlind = heroIsBlind(state);
        await breakObjectAtLocation(venom, { state, publish, random });
        if (venom.otyp === BLINDING_VENOM) {
            await publish("You've got it all over your face!");
            if (blindIncrement) {
                if (!wasBlind) await publish('It blinds you!');
                state.u.ucreamed = (state.u.ucreamed ?? 0) + blindIncrement;
                state.u.blindTurns = (state.u.blindTurns ?? 0)
                    + blindIncrement;
                syncBlindness(state);
            }
        }
        return { destroyed: true };
    }
    return dropVenomAtHero(venom, state, publish, random, false);
}

async function hitMonsterWithVenom({
    monster, venom, state, publish, random, rollOne, swallowed,
    finishMonsterKill,
}) {
    const impact = await hitMonsterWithThrownCreamOrVenom(
        monster, venom, {
            state,
            guaranteedHit: swallowed,
            publish,
            random,
            rollOne,
            finishMonsterKill: target => finishMonsterKill(
                target,
                target.mx,
                target.my,
                swallowed
                    ? { deathContext: { kind: 'swallowed-venom' } }
                    : undefined,
            ),
        },
    );
    return impact.consumed;
}

async function spitHorizontally({
    venom, direction, state, publish, random, rollOne,
    captureFlight, recoilHero, finishMonsterKill,
}) {
    if (state.u?.uswallow && state.u?.ustuck) {
        await hitMonsterWithVenom({
            monster: state.u.ustuck, venom, state, publish, random, rollOne,
            swallowed: true, finishMonsterKill,
        });
        return { destroyed: true };
    }

    const underwater = state.underwater || state.u?.uinwater;
    const trajectory = underwater
        ? { range: 1, recoil: 0 }
        : heroThrowTrajectory(venom, state);
    const flight = await flyHeroThrownObject({
        state, object: venom,
        dx: direction.dx, dy: direction.dy,
        range: trajectory.range,
        captureFlight, publish, random,
    });
    if (trajectory.recoil) {
        await recoilHero(
            -direction.dx, -direction.dy, trajectory.recoil,
            { verbose: true },
        );
    }
    if (flight.destroyed) return flight;
    if (flight.contact) {
        const consumed = await hitMonsterWithVenom({
            monster: flight.contact, venom, state, publish, random, rollOne,
            swallowed: false, finishMonsterKill,
        });
        if (consumed) return { ...flight, destroyed: true };
    }
    const broken = await breakVenomAtEndpoint(
        venom, flight.x, flight.y, state, publish, random,
    );
    return { ...flight, destroyed: broken.destroyed };
}

export async function useHeroSpit({
    state = game,
    attack = heroSpitAttack(state),
    readDirection = promptDirection,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
    captureFlight = captureThrownObjectFlight,
    recoilHero = hurtleHero,
    finishMonsterKill = finishHeroMonsterKill,
} = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-spit' };

    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    Object.assign(state.u, {
        dx: direction.dx,
        dy: direction.dy,
        dz: direction.dz,
    });
    const venom = mksobj(venomTypeForAttack(attack), true, false);
    venom.spe = 1;
    venom.where = 'free';
    venom.how_lost = LOST_THROWN;

    let result;
    if (state.u?.uswallow) {
        result = await spitHorizontally({
            venom, direction, state, publish, random, rollOne,
            captureFlight, recoilHero, finishMonsterKill,
        });
    } else if (direction.dz < 0) {
        result = await tossVenomUp(venom, state, publish, random, rollOne);
    } else if (direction.dz > 0) {
        result = await dropVenomAtHero(
            venom, state, publish, random, true,
        );
    } else {
        result = await spitHorizontally({
            venom, direction, state, publish, random, rollOne,
            captureFlight, recoilHero, finishMonsterKill,
        });
    }
    return { ...result, venom, used: true, spentTime: true };
}
