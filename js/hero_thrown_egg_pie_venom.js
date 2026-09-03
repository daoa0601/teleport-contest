// Eggs, cream pies, and venom thrown by the hero.
// C refs: dothrow.c thitmonst() and uhitm.c hmon_hitmon_misc_obj().

import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    applyMonsterBlindness, heroBlindingObjectHitMessage,
    monsterCanBeBlindedByObject,
} from './blinding_attack.js';
import { A_DEX, A_WIS } from './const.js';
import {
    canProjectMonster, plineWithContinuation,
} from './display.js';
import { abusePetAfterHeroHit } from './dog.js';
import {
    applyHeroEggLuckPenalty, eggHasMonsterSpecies, eggIsStale,
    explodePyroliskEggAt, isPyroliskEgg, turnEggIntoRock,
} from './egg_impact.js';
import { place_object } from './floor_object.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import {
    MONSTER_NAME, monsterTypeName,
} from './monster_data.js';
import {
    monsterHasAcidResistance, monsterHasStoneResistance,
} from './monster_resistance.js';
import { deleteObject } from './object_delete.js';
import {
    ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG,
} from './object_data.js';
import { rn2, rnd } from './rng.js';
import { touchPetrifies } from './stoning.js';
import { prepareHeroThrownTarget } from './thrown_object.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';

const EGG_PIE_AND_VENOM_TYPES = new Set([
    EGG, CREAM_PIE, BLINDING_VENOM, ACID_VENOM,
]);

export function isHeroThrownEggPieOrVenom(object) {
    return EGG_PIE_AND_VENOM_TYPES.has(object?.otyp);
}

function targetName(monster) {
    if (!canProjectMonster(monster, monster.mx, monster.my)) return 'it';
    return monster.name
        || `the ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function missName(object) {
    if (object.otyp === EGG) return 'egg';
    return object.otyp === CREAM_PIE ? 'cream pie' : 'splash of venom';
}

async function finishEggKill(monster, options, finishMonsterKill) {
    if (finishMonsterKill) return finishMonsterKill(monster, options);
    return finishHeroMonsterKill(
        monster, monster.mx, monster.my, options,
    );
}

function explosionDeathFinisher(engulfer, finishEngulferKill) {
    if (!finishEngulferKill) return undefined;
    return (monster, x, y, options) => {
        if (monster === engulfer)
            return finishEngulferKill(monster, options);
        return finishHeroMonsterKill(monster, x, y, options);
    };
}

async function applyEggDamage(monster, state, finishMonsterKill) {
    const damage = 1;
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    await abusePetAfterHeroHit(monster, damage, state);
    if (monster.mhp <= 0) {
        const result = await finishEggKill(monster, {}, finishMonsterKill);
        return { hit: true, consumed: true, damage, result };
    }
    await wakeAttackedMonster(monster);
    return { hit: true, consumed: true, damage, result: true };
}

function eggSuffix(count) {
    return count === 1 ? '' : 's';
}

function ordinaryEggDescription(egg, count) {
    if (eggHasMonsterSpecies(egg) && egg.known)
        return `the ${monsterTypeName(egg.corpsenm)}`;
    return count === 1 ? 'an' : 'some';
}

async function hitWithEgg(
    monster,
    egg,
    state,
    publish,
    random,
    rollOne,
    finishMonsterKill,
) {
    const count = egg.quan ?? egg.quantity ?? 1;
    applyHeroEggLuckPenalty(egg, state);

    if (eggHasMonsterSpecies(egg) && touchPetrifies(egg.corpsenm)) {
        const article = egg.known ? 'the' : count === 1 ? 'a' : 'some';
        const species = egg.known
            ? monsterTypeName(egg.corpsenm) : 'petrifying';
        await publish(
            `Splat! You hit ${targetName(monster)} with ${article} ${species} `
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
                hit: true,
                consumed: true,
                damage: 0,
                result: petrification.survived,
            };
        }
        return applyEggDamage(monster, state, finishMonsterKill);
    }

    await publish(
        `You hit ${targetName(monster)} with ${ordinaryEggDescription(
            egg, count,
        )} egg${eggSuffix(count)}.`,
    );
    if (touchPetrifies(monster.mnum) && !eggIsStale(egg, state)) {
        await publish(
            `The egg${eggSuffix(count)} ${count === 1 ? "isn't" : "aren't"} `
            + 'alive any more...',
        );
        turnEggIntoRock(egg);
        place_object(egg, monster.mx, monster.my, state);
        return applyEggDamage(monster, state, finishMonsterKill);
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
        return {
            hit: true,
            consumed: true,
            damage: 0,
            result: state.level?.monsters?.includes(monster) ?? false,
        };
    }

    await publish('Splat!');
    deleteObject(egg, state);
    exerciseAttribute(A_WIS, false, state);
    return applyEggDamage(monster, state, finishMonsterKill);
}

async function hitWithBlindingObject(
    monster, object, state, publish, rollOne,
) {
    monster.msleeping = 0;
    const heroInsideTarget = !!state.u?.uswallow
        && state.u?.ustuck === monster;
    const canBlind = monsterCanBeBlindedByObject(monster, object.otyp, {
        heroInsideTarget,
        state,
    });
    await publish(heroBlindingObjectHitMessage(monster, object, {
        canBlind,
        state,
        describeTarget: () => targetName(monster),
    }));
    await angerAttackedMonster(monster);
    if (canBlind) applyMonsterBlindness(monster, rollOne);
    deleteObject(object, state);
    await wakeAttackedMonster(monster);
    return { hit: true, consumed: true, damage: 0, result: true };
}

async function hitWithAcidVenom(
    monster,
    venom,
    state,
    publish,
    rollOne,
    finishMonsterKill,
) {
    let damage = 0;
    if (monsterHasAcidResistance(monster)) {
        await publish(`Your venom hits ${targetName(monster)} harmlessly.`);
    } else {
        await publish(`Your venom burns ${targetName(monster)}!`);
        damage = rollPhysicalWeaponDamage(venom, monster, { rollOne });
    }
    deleteObject(venom, state);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    await abusePetAfterHeroHit(monster, damage, state);

    let result = true;
    if (monster.mhp <= 0) {
        result = finishMonsterKill
            ? await finishMonsterKill(monster)
            : await finishHeroMonsterKill(monster, monster.mx, monster.my);
    } else {
        await wakeAttackedMonster(monster);
    }
    return { hit: true, consumed: true, damage, result };
}

export async function hitMonsterWithThrownEggPieOrVenom(
    monster,
    object,
    {
        state = game,
        guaranteedHit = false,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        finishMonsterKill = null,
    } = {},
) {
    if (!isHeroThrownEggPieOrVenom(object)) return null;

    prepareHeroThrownTarget(monster, random);
    rollOne(20);
    if (!guaranteedHit && currentAttribute(A_DEX, state) <= rollOne(25)) {
        await publish(`The ${missName(object)} misses ${targetName(monster)}.`);
        if (random(3) === 0) await wakeAttackedMonster(monster);
        return { hit: false, consumed: false, damage: 0, result: false };
    }

    if (object.otyp === EGG) {
        return hitWithEgg(
            monster, object, state, publish, random, rollOne,
            finishMonsterKill,
        );
    }
    if (object.otyp === ACID_VENOM) {
        return hitWithAcidVenom(
            monster, object, state, publish, rollOne, finishMonsterKill,
        );
    }
    return hitWithBlindingObject(monster, object, state, publish, rollOne);
}
