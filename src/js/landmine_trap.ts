// Land mines triggered by monsters.
// C ref: trap.c:trapeffect_landmine().

import type { Monster } from './monster_types.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { MessagePublisher } from './display.js';
import type { MonsterDeathHandler } from './monster_death.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { WT_ELF } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { explodeLandMine } from './landmine_explosion.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { resolveMonsterLiquid } from './mon.js';
import { MONSTER_BODY_META, MONSTER_NAME } from './monster_data.js';
import { beginMonsterPitTrap, finishMonsterPitTrap } from './monster_pit_trap.js';
import { monsterWearsIronShoes } from './monworn.js';
import { monsterName } from './monster_name.js';
import { rn2, rnd } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';
import { monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';

export interface MonsterLandMineEvent {
    kind: 'land-mine';
    trap: Trap;
    damage: number;
    exploded: boolean;
    killed: boolean;
    finished: boolean;
    airborne: boolean;
    alreadySeen: boolean;
    discoveredTrigger: boolean;
    inSight: boolean;
    seeSquare: boolean;
    airCurrentRoll?: number;
    death?: Awaited<ReturnType<MonsterDeathHandler>>;
}

interface LandMineOptions {
    finishDeath?: MonsterDeathHandler;
    publish?: MessagePublisher;
    random?: (limit: number) => number;
    rollOne?: (sides: number) => number;
    describeMonster?: (monster: Monster) => string;
}

type ActiveLandMineOptions = Required<LandMineOptions>;

function ordinaryMonsterName(monster: Monster) {
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}

function ordinaryMonsterSubject(monster: Monster) {
    return `The ${ordinaryMonsterName(monster)}`;
}

async function finishMineDeath(
    monster: Monster,
    event: MonsterLandMineEvent,
    state: GameState,
    options: ActiveLandMineOptions,
) {
    const death = await finishMonsterKilled(monster, state, {
        damageType: AD_PHYS,
        random: options.random,
        publish: options.publish,
    });
    event.death = death;
    if (!death.survived) {
        event.killed = true;
        return true;
    }
    monster.dead = false;
    return false;
}

async function fallIntoMinePit(
    monster: Monster,
    trap: Trap | null,
    event: MonsterLandMineEvent,
    state: GameState,
    options: ActiveLandMineOptions,
) {
    if (!trap) return;
    // The recursive mintrap(FORCETRAP) teaches the new trap type before
    // trapeffect_pit(), including when the victim is immune to the fall.
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    const pit = beginMonsterPitTrap(monster, trap, state, { forced: true });
    if (!pit) return;
    await finishMonsterPitTrap(monster, pit, {
        state,
        publish: options.publish,
        random: options.random,
        rollOne: options.rollOne,
        describeMonster: options.describeMonster,
    });
    if (pit.death) event.death = pit.death;
    if (pit.killed) event.killed = true;
}

async function resolveMineLiquid(
    monster: Monster,
    state: GameState,
    options: ActiveLandMineOptions,
) {
    return resolveMonsterLiquid(monster, state, {
        announce: options.publish,
        monsterMoving: true,
        random: options.random,
        finishDeath: async (victim, death) =>
            options.finishDeath(victim, {
                noCorpse: !death.leaveCorpse,
                random: death.random,
                sadFeeling: death.sadFeeling,
                publish: options.publish,
            }),
    });
}

export function beginMonsterLandMine(
    monster: Monster,
    trap: Trap,
    state: GameState = game,
    { random = rn2, rollOne = rnd } = {},
): MonsterLandMineEvent {
    const visibility = monsterTrapVisibility(monster, state);
    const rawDamage = rollOne(16);
    const damage = monsterWearsIronShoes(monster) ? Math.trunc((rawDamage + 3) / 4) : rawDamage;
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    const triggerWeight = Math.trunc(WT_ELF / 2);
    const triggerRoll = random(Math.max(1, bodyWeight + 1));
    const event: MonsterLandMineEvent = {
        kind: 'land-mine',
        trap,
        damage,
        exploded: false,
        killed: false,
        finished: false,
        airborne: false,
        alreadySeen: !!trap.tseen,
        discoveredTrigger: false,
        ...visibility,
    };
    if (triggerRoll < triggerWeight) {
        event.finished = true;
        return event;
    }

    event.airborne = monsterInAir(monster, state);
    if (event.airborne) {
        event.discoveredTrigger = event.inSight && !trap.tseen;
        // The discovery message can wait for input. Reveal and test the air
        // currents only after that message has returned, as in C.
        if (event.discoveredTrigger) return event;
        event.airCurrentRoll = random(3);
        if (event.airCurrentRoll !== 0) {
            event.finished = true;
            return event;
        }
    }
    event.exploded = true;
    return event;
}

export function landMineNeedsResume(
    event: { kind: string; exploded?: boolean; discoveredTrigger?: boolean } | null | undefined,
) {
    return event?.kind === 'land-mine' && !!(event.exploded || event.discoveredTrigger);
}

export async function finishMonsterLandMine(
    monster: Monster,
    event: MonsterLandMineEvent,
    state: GameState = game,
    {
        finishDeath,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        describeMonster = ordinaryMonsterSubject,
    }: LandMineOptions = {},
) {
    if (event.finished) return event;
    if (typeof finishDeath !== 'function')
        throw new TypeError('land mine requires the monster death handler');
    const options = {
        finishDeath,
        publish,
        random,
        rollOne,
        describeMonster,
    };

    if (event.discoveredTrigger) {
        await publish(`A trigger appears in a pile of soil below ${monsterName(monster, { state })}.`);
        seeTrap(event.trap, state);
        event.airCurrentRoll = random(3);
        event.exploded = event.airCurrentRoll === 0;
    }
    if (!event.exploded) {
        event.finished = true;
        return event;
    }
    // Native redraws the visible victim before the detonation message can
    // pause for input, including monsters seen only through infravision.
    if (event.inSight) newsym(monster.mx, monster.my);
    if (event.airborne && event.inSight) {
        await publish(`The air currents set ${event.alreadySeen ? 'a land mine' : 'it'} off!`);
    } else if (event.inSight) {
        const blast = state.u?.deaf || state.deaf ? '' : 'KAABLAMM!!!  ';
        await publish(
            `${blast}${describeMonster(monster)} triggers ${
                event.trap.madeby_u ? 'your' : 'a'
            } land mine!`,
        );
    } else if (!state.u?.deaf && !state.deaf) {
        await publish('Kaablamm!  You hear an explosion in the distance!');
    }

    const pit = await explodeLandMine(event.trap, state, {
        publish,
        random,
        rollOne,
        seeSquare: event.seeSquare,
        finishMonsterDeath: finishDeath,
        resolveLiquid: () => resolveMineLiquid(monster, state, options),
    });
    if (state.program_state.gameover) return event;
    if (monster.dead || (monster.mhp ?? 0) <= 0 || !state.level?.monsters?.includes(monster)) {
        event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
        event.finished = true;
        return event;
    }
    if (monster.mx !== event.trap.tx || monster.my !== event.trap.ty) {
        event.finished = true;
        return event;
    }

    monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    if (monster.mhp <= 0) {
        const died = await finishMineDeath(monster, event, state, options);
        if (event.death?.heroDied) return event;
        if (died) {
            await fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state, { publish });
            event.finished = true;
            return event;
        }
    }
    await fallIntoMinePit(monster, pit, event, state, options);
    if (event.death?.heroDied || state.program_state.gameover) return event;
    await fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state, { publish });
    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
}
