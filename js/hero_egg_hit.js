// What happens when an egg hits a monster.
// C ref: uhitm.c hmon_hitmon_misc_obj(), case EGG.

import { exerciseAttribute } from './attrib.js';
import { A_WIS } from './const.js';
import {
    applyHeroEggLuckPenalty, eggHasMonsterSpecies, eggIsStale,
    explodePyroliskEggAt, isPyroliskEgg, turnEggIntoRock,
} from './egg_impact.js';
import { place_object } from './floor_object.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { monsterTypeName } from './monster_data.js';
import { monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { deleteObject } from './object_delete.js';
import { EGG } from './object_data.js';
import { rnd, rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';

function eggSuffix(count) {
    return count === 1 ? '' : 's';
}

function ordinaryEggDescription(egg, count) {
    if (eggHasMonsterSpecies(egg) && egg.known)
        return `the ${monsterTypeName(egg.corpsenm)}`;
    return count === 1 ? 'an' : 'some';
}

async function finishEggKill(monster, options, finishMonsterKill) {
    if (finishMonsterKill) return finishMonsterKill(monster, options);
    return finishHeroMonsterKill(
        monster, monster.mx, monster.my, options,
    );
}

function explosionDeathFinisher(target, finishTargetKill) {
    if (!finishTargetKill) return undefined;
    return (monster, x, y, options) => {
        if (monster === target) return finishTargetKill(monster, options);
        return finishHeroMonsterKill(monster, x, y, options);
    };
}

function completedEggAttack(monster, state) {
    return {
        attackComplete: true,
        damage: 0,
        addHeroDamageBonuses: false,
        specialMessage: true,
        monsterSurvived: state.level?.monsters?.includes(monster) ?? false,
    };
}

export async function resolveHeroEggHit(monster, egg, {
    state = game,
    thrown = false,
    publish,
    random = rn2,
    rollOne = rnd,
    finishMonsterKill = null,
    describeTarget = () => `the ${monsterTypeName(
        monster.mnum, !!monster.female,
    )}`,
} = {}) {
    if (egg?.otyp !== EGG) return null;

    const count = egg.quan ?? egg.quantity ?? 1;
    if (!thrown && (state.uwep === egg || state.u?.uwep === egg))
        state._unweapon = true;
    applyHeroEggLuckPenalty(egg, state);

    if (eggHasMonsterSpecies(egg) && touchPetrifies(egg.corpsenm)) {
        const article = egg.known ? 'the' : count === 1 ? 'a' : 'some';
        const species = egg.known
            ? monsterTypeName(egg.corpsenm) : 'petrifying';
        await publish(
            `Splat! You hit ${describeTarget()} with ${article} ${species} `
            + `egg${eggSuffix(count)}!`,
        );
        egg.known = true;
        deleteObject(egg, state);
        const petrification = await petrifyMonsterFromContact(monster, {
            creditHero: true,
            finishDeath: (target, death) => finishEggKill(target, {
                ...death,
                showKillMessage: false,
                recordConduct: false,
            }, finishMonsterKill),
            publish,
            rollOne,
            state,
        });
        if (!monsterHasStoneResistance(monster)) {
            return {
                ...completedEggAttack(monster, state),
                monsterSurvived: petrification.survived,
            };
        }
        return {
            damage: 1,
            addHeroDamageBonuses: false,
            specialMessage: true,
        };
    }

    await publish(
        `You hit ${describeTarget()} with ${ordinaryEggDescription(
            egg, count,
        )} egg${eggSuffix(count)}.`,
    );
    if (touchPetrifies(monster.mnum) && !eggIsStale(egg, state)) {
        await publish(
            `The egg${eggSuffix(count)} ${count === 1 ? "isn't" : "aren't"} `
            + 'alive any more...',
        );
        turnEggIntoRock(egg);
        if (thrown) place_object(egg, monster.mx, monster.my, state);
        return {
            damage: 1,
            addHeroDamageBonuses: false,
            specialMessage: true,
        };
    }

    if (isPyroliskEgg(egg)) {
        deleteObject(egg, state);
        await explodePyroliskEggAt(monster.mx, monster.my, {
            state,
            heroCaused: true,
            publish,
            random,
            finishMonsterKill: explosionDeathFinisher(
                monster, finishMonsterKill,
            ),
        });
        return completedEggAttack(monster, state);
    }

    await publish('Splat!');
    deleteObject(egg, state);
    exerciseAttribute(A_WIS, false, state);
    return {
        damage: 1,
        addHeroDamageBonuses: false,
        specialMessage: true,
    };
}
