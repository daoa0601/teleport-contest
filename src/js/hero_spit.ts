// The #monster spit command for a polymorphed hero.
// C refs: polyself.c dospit(), dothrow.c throwit()/thitmonst()/toss_up(),
// and uhitm.c hmon() venom cases.

import type { MonsterAttack } from './data_types.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { ProjectileFlightCapture } from './thrown_object.js';
import { heroCanBeBlindedByVenom } from './blinding_attack.js';
import { IS_SOFT, LOST_THROWN } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { cansee } from './vision.js';
import {
    hitMonsterWithThrownEggPieOrVenom,
} from './hero_thrown_egg_pie_venom.js';
import { hurtleHero } from './hero_hurtle.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { mksobj } from './mklev.js';

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
import { heroIsBlind } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { surfaceName } from './terrain_name.js';
import {
    captureThrownObjectFlight, flyHeroThrownObject, heroThrowTrajectory,
} from './thrown_object.js';
import { promptDirection } from './tty_prompts.js';
import { levelHasCeiling } from './terrain_properties.js';

export function heroSpitAttack(state = game) {
    const form = heroMonsterForm(state);
    if (form == null) return null;
    return (MONSTER_ATTACKS[form] || []).find(
        ([attackType]) => attackType === AT_SPIT,
    ) || null;
}

function venomTypeForAttack(attack: MonsterAttack) {
    const damageType = attack?.[1];
    return damageType === AD_BLND || damageType === AD_DRST
        ? BLINDING_VENOM : ACID_VENOM;
}

async function settleVenom(venom: GameObject, x: number, y: number, state: GameState) {
    placeCreatedObject(venom, x, y);
    await stack_object(venom, state);
    newsym(x, y);
}

async function breakVenomAtEndpoint(
    venom: GameObject, x: number, y: number, state: GameState,
    publish: MessagePublisher, random: typeof rn2,
) {
    venom.ox = x;
    venom.oy = y;
    const location = state.level?.at?.(x, y);
    if (location && !IS_SOFT(location.typ))
        objectBreaksOnImpact(venom, random);
    return breakObjectAtLocation(venom, {
        x, y, fromInventory: true, inView: cansee(x, y), state, publish, random,
    });
}

async function dropVenomAtHero(
    venom: GameObject, state: GameState, publish: MessagePublisher,
    random: typeof rn2, verbose: boolean,
) {
    const x = state.u.ux;
    const y = state.u.uy;
    const location = state.level?.at?.(x, y);
    const underwater = state.underwater || state.u?.uinwater;
    if (!location || IS_SOFT(location.typ) || underwater) {
        await settleVenom(venom, x, y, state);
        return { destroyed: false };
    }

    venom.ox = x;
    venom.oy = y;
    if (verbose) {
        await publish(`A ${venom.name || 'splash of venom'} hits the ${
            surfaceName(x, y, state)}.`);
    }
    const result = await breakFloorObject(venom, {
        x, y, fromInventory: true, state, publish, random,
    });
    if (!result.destroyed) await settleVenom(venom, x, y, state);
    return result;
}

async function tossVenomUp(
    venom: GameObject, state: GameState, publish: MessagePublisher,
    random: typeof rn2, rollOne: typeof rnd,
) {
    const underwater = state.underwater || state.u?.uinwater;
    const hitsRoof = random(5) !== 0 && !underwater;
    const hasCeiling = levelHasCeiling(state);
    const ceiling = hasCeiling ? 'ceiling'
        : underwater ? 'water above' : 'sky';

    venom.ox = state.u.ux;
    venom.oy = state.u.uy;
    if (hasCeiling && hitsRoof && objectBreaksOnImpact(venom, random)) {
        await publish(`A splash of venom hits the ${ceiling}.`);
        return breakObjectAtLocation(venom, {
            fromInventory: true, state, publish, random,
        });
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
        await breakObjectAtLocation(venom, {
            fromInventory: true, state, publish, random,
        });
        if (venom.otyp === BLINDING_VENOM) {
            await publish("You've got it all over your face!");
            if (blindIncrement) {
                if (!wasBlind) await publish('It blinds you!');
                state.u.ucreamed = (state.u.ucreamed ?? 0) + blindIncrement;
                await makeBlinded((state.u.blindTurns ?? 0) + blindIncrement, { state, talk: false, publish });
            }
        }
        return { destroyed: true };
    }
    return dropVenomAtHero(venom, state, publish, random, false);
}

interface VenomImpactOptions {
    monster: Monster;
    target: Position;
    venom: GameObject;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    swallowed: boolean;
    finishMonsterKill: typeof finishHeroMonsterKillOutcome;
}

async function hitMonsterWithVenom({
    monster, target, venom, state, publish, random, rollOne, swallowed,
    finishMonsterKill,
}: VenomImpactOptions) {
    const impact = await hitMonsterWithThrownEggPieOrVenom(
        monster, venom, {
            state,
            target,
            guaranteedHit: swallowed,
            publish,
            random,
            rollOne,
            finishMonsterKill: (victim, options) => finishMonsterKill(
                victim,
                victim.mx,
                victim.my,
                swallowed
                    ? { ...options, deathContext: { kind: 'swallowed-venom' } }
                    : options,
            ),
        },
    );
    if (!impact) throw new Error(`Spitting requires a venom object, received object type ${venom.otyp}`);
    return impact;
}

interface SpitDirection {
    key: string;
    dx: number;
    dy: number;
    dz: number;
}

interface HorizontalSpitOptions {
    venom: GameObject;
    direction: SpitDirection;
    state: GameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    captureFlight: ProjectileFlightCapture;
    recoilHero: typeof hurtleHero;
    finishMonsterKill: typeof finishHeroMonsterKillOutcome;
}

async function spitHorizontally({
    venom, direction, state, publish, random, rollOne,
    captureFlight, recoilHero, finishMonsterKill,
}: HorizontalSpitOptions) {
    if (state.u?.uswallow && state.u?.ustuck) {
        const impact = await hitMonsterWithVenom({
            monster: state.u.ustuck, venom, state, publish, random, rollOne,
            target: { x: state.u.ux, y: state.u.uy },
            swallowed: true, finishMonsterKill,
        });
        return { ...impact, destroyed: true };
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
        const impact = await hitMonsterWithVenom({
            monster: flight.contact, venom, state, publish, random, rollOne,
            target: { x: flight.x, y: flight.y },
            swallowed: false, finishMonsterKill,
        });
        if (impact.heroDied) return impact;
        if (impact.consumed) return { ...flight, destroyed: true };
    }
    const broken = await breakVenomAtEndpoint(
        venom, flight.x, flight.y, state, publish, random,
    );
    return { ...flight, destroyed: broken.destroyed };
}

interface HeroSpitOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    readDirection?: () => SpitDirection | null | Promise<SpitDirection | null>;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    captureFlight?: ProjectileFlightCapture;
    recoilHero?: typeof hurtleHero;
    finishMonsterKill?: typeof finishHeroMonsterKillOutcome;
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
    finishMonsterKill = finishHeroMonsterKillOutcome,
}: HeroSpitOptions = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-spit' };

    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    const venom = await mksobj(venomTypeForAttack(attack), true, false);
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
