// Land mines triggered by monsters.
// C ref: trap.c:trapeffect_landmine().
import { finishMonsterTrapDeath } from './monster_death.js';
import { AD_PHYS } from './monster_attack_types.js';
import { WT_ELF } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { explodeLandMine } from './landmine_explosion.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { resolveMonsterLiquid } from './mon.js';
import { MONSTER_BODY_META } from './monster_data.js';
import { beginMonsterPitTrap, finishMonsterPitTrap } from './monster_pit_trap.js';
import { monsterWearsIronShoes } from './monworn.js';
import { rn2, rnd } from './rng.js';
import { monsterTrapVisibility, seeTrap } from './trap.js';
import { monsterInAir } from './terrain_properties.js';
import { monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';
import { monsterName as canonicalMonsterName } from './monster_name.js';
async function finishMineDeath(monster, event, state, options) {
    const death = await finishMonsterTrapDeath(monster, state, {
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
async function fallIntoMinePit(monster, trap, event, state, options) {
    if (!trap)
        return;
    // The recursive mintrap(FORCETRAP) teaches the new trap type before
    // trapeffect_pit(), including when the victim is immune to the fall.
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    const pit = beginMonsterPitTrap(monster, trap, state, { forced: true });
    if (!pit)
        return;
    await finishMonsterPitTrap(monster, pit, {
        state,
        publish: options.publish,
        random: options.random,
        rollOne: options.rollOne,
        describeMonster: options.describeMonster,
    });
    if (pit.death)
        event.death = pit.death;
    if (pit.killed)
        event.killed = true;
}
async function resolveMineLiquid(monster, state, options) {
    return resolveMonsterLiquid(monster, state, {
        announce: options.publish,
        monsterMoving: true,
        random: options.random,
        finishDeath: async (victim, death) => options.finishDeath(victim, {
            noCorpse: !death.leaveCorpse,
            random: death.random,
            sadFeeling: death.sadFeeling,
            publish: options.publish,
        }),
    });
}
export function beginMonsterLandMine(monster, trap, state = game, { random = rn2, rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    const rawDamage = rollOne(16);
    const damage = monsterWearsIronShoes(monster) ? Math.trunc((rawDamage + 3) / 4) : rawDamage;
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    const triggerWeight = Math.trunc(WT_ELF / 2);
    const triggerRoll = random(Math.max(1, bodyWeight + 1));
    const event = {
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
        if (event.discoveredTrigger)
            return event;
        event.airCurrentRoll = random(3);
        if (event.airCurrentRoll !== 0) {
            event.finished = true;
            return event;
        }
    }
    event.exploded = true;
    return event;
}
export function landMineNeedsResume(event) {
    return event?.kind === 'land-mine' && !!(event.exploded || event.discoveredTrigger);
}
export async function finishMonsterLandMine(monster, event, state = game, { finishDeath, publish = plineWithContinuation, random = rn2, rollOne = rnd, describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }), } = {}) {
    if (event.finished)
        return event;
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
        await publish(`A trigger appears in a pile of soil below ${canonicalMonsterName(monster, { state })}.`);
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
    if (event.inSight)
        newsym(monster.mx, monster.my);
    if (event.airborne && event.inSight) {
        await publish(`The air currents set ${event.alreadySeen ? 'a land mine' : 'it'} off!`);
    }
    else if (event.inSight) {
        const blast = state.u?.deaf || state.deaf ? '' : 'KAABLAMM!!!  ';
        await publish(`${blast}${describeMonster(monster)} triggers ${event.trap.madeby_u ? 'your' : 'a'} land mine!`);
    }
    else if (!state.u?.deaf && !state.deaf) {
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
    if (state.program_state.gameover)
        return event;
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
        if (event.death?.heroDied)
            return event;
        if (died) {
            await fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state, { publish });
            event.finished = true;
            return event;
        }
    }
    await fallIntoMinePit(monster, pit, event, state, options);
    if (event.death?.heroDied || state.program_state.gameover)
        return event;
    await fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state, { publish });
    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
}
//# sourceMappingURL=landmine_trap.js.map