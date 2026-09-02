// Items a monster can use to stop immediate petrification.
// C refs: muse.c munstone(), mon_consume_unstone(), and cures_stoning().

import {
    NORMAL_SPEED, P_DAGGER, P_KNIFE, STRAT_WAITFORU,
} from './const.js';
import { canSeeMonster, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { deleteObject } from './object_delete.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SYMBOL, monsterIsAnimal, monsterTypeName,
} from './monster_data.js';
import {
    monsterHasAcidResistance, monsterHasStoneResistance,
} from './monster_resistance.js';
import {
    clearMonsterCarriedObjectState, removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import {
    adjustMonsterSpeed, monsterSpeedMessage,
} from './monster_speed.js';
import {
    CORPSE, GLOB_OF_GREEN_SLIME, OBJECT_DELAY, OBJECT_NAMES,
    OBJECT_NUTRITION, OBJECT_SUBTYPE, POT_ACID, TIN, TIN_OPENER,
} from './object_data.js';
import { rnd } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { objectWeight } from './weight.js';

const M1_ACID = 0x08000000;
const S_GHOST = 54;
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const SLIMEPROOF_FIRE_MONSTERS = new Set([
    'fire vortex', 'flaming sphere', 'fire elemental', 'salamander',
].map(name => MONSTER_NAME.indexOf(name)));

function monsterSubject(monster) {
    if (monster.name) return monster.name;
    return `The ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function monsterCanOpenTin(monster) {
    if (monsterIsAnimal(monster)) return false;
    const inventory = monster.minvent || monster.inventory || [];
    const wielded = monster.mw;
    const opensTin = object => object?.otyp === TIN_OPENER
        || [P_DAGGER, P_KNIFE].includes(OBJECT_SUBTYPE[object?.otyp]);
    if (wielded?.cursed) return opensTin(wielded);
    return inventory.some(opensTin);
}

function monsterIsSlimeproof(monster) {
    return monster?.mnum === PM_GREEN_SLIME
        || SLIMEPROOF_FIRE_MONSTERS.has(monster?.mnum)
        || MONSTER_SYMBOL[monster?.mnum] === S_GHOST;
}

function corpseCuresStoning(object) {
    if (!Number.isInteger(object?.corpsenm) || object.corpsenm < 0)
        return false;
    return object.corpsenm === PM_LIZARD
        || !!((MONSTER_FLAGS1[object.corpsenm] ?? 0) & M1_ACID);
}

function curesStoning(monster, object, tinCanBeOpened) {
    if (object?.otyp === POT_ACID) return true;
    if (object?.otyp === GLOB_OF_GREEN_SLIME)
        return monsterIsSlimeproof(monster);
    if (object?.otyp === CORPSE) return corpseCuresStoning(object);
    return object?.otyp === TIN && tinCanBeOpened
        && corpseCuresStoning(object);
}

function cureObjectName(object) {
    const species = MONSTER_NAME[object.corpsenm];
    let noun;
    if (object.otyp === POT_ACID) noun = 'potion of acid';
    else if (object.otyp === CORPSE && species)
        noun = `${species} corpse`;
    else if (object.otyp === TIN && species)
        noun = `tin of ${species} meat`;
    else noun = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
    return `${article} ${noun}`;
}

function partiallyEatenValue(value, object, fullNutrition) {
    if (!(object.oeaten > 0) || fullNutrition <= 0) return value;
    return Math.max(1, Math.trunc(value * object.oeaten / fullNutrition));
}

function monsterFoodNutrition(monster, object) {
    let delay;
    let nutrition;
    let fullNutrition;
    if (object.otyp === CORPSE) {
        const [weight = 0, corpseNutrition = 0]
            = MONSTER_BODY_META[object.corpsenm] || [];
        delay = 3 + (weight >> 6);
        nutrition = fullNutrition = corpseNutrition;
    } else {
        delay = OBJECT_DELAY[object.otyp] ?? 0;
        nutrition = fullNutrition = OBJECT_NUTRITION[object.otyp] ?? 0;
    }

    const sizeMultiplier = [8, 6, 5, 4, 3, 2][
        MONSTER_SIZE[monster.mnum] ?? 2
    ] ?? 5;
    nutrition *= sizeMultiplier;
    monster.meating = partiallyEatenValue(delay, object, fullNutrition);
    return partiallyEatenValue(nutrition, object, fullNutrition);
}

function consumeOneCure(monster, object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        if (monster.mw === object) monster.mw = null;
        object.wielded = false;
        removeObjectFromMonsterInventory(monster, object);
        clearMonsterCarriedObjectState(object);
        object.where = 'free';
        deleteObject(object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
    monster.hasInventory = true;
}

async function describeCure(monster, cure, visible, state, publish) {
    if (visible) {
        const tinned = cure.otyp === TIN;
        const verb = cure.otyp === POT_ACID
            ? 'quaffs' : tinned ? 'opens and eats the contents of' : 'eats';
        await publish(
            `${monsterSubject(monster)} ${verb} ${cureObjectName(cure)}.`,
        );
    } else if (!heroIsDeaf(state)) {
        await publish(cure.otyp === POT_ACID
            ? 'You hear drinking.' : 'You hear chewing.');
    }
}

export async function useMonsterStoningCure(monster, {
    finishDeath,
    publish = plineWithContinuation,
    rollOne = rnd,
    state = game,
} = {}) {
    if (monsterHasStoneResistance(monster) || monster?.meating
        || monster?.msleeping || !monster?.mcanmove) {
        return { consumed: false, died: false };
    }

    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    const tinCanBeOpened = monsterCanOpenTin(monster);
    const inventory = monster.minvent || monster.inventory || [];
    const cure = inventory.find(object =>
        curesStoning(monster, object, tinCanBeOpened));
    if (!cure) return { consumed: false, died: false };

    const visible = canSeeMonster(monster, monster.mx, monster.my);
    const tinned = cure.otyp === TIN;
    const food = cure.otyp === CORPSE || tinned;
    const acidic = cure.otyp === POT_ACID
        || (food && !!((MONSTER_FLAGS1[cure.corpsenm] ?? 0) & M1_ACID));
    const lizard = food && cure.corpsenm === PM_LIZARD;
    const nutrition = food ? monsterFoodNutrition(monster, cure) : 0;

    const speed = adjustMonsterSpeed(monster, -3);
    const speedMessage = state.flags?.verbose === false
        ? null : monsterSpeedMessage(speed, monsterSubject(monster));
    if (visible && speedMessage) await publish(speedMessage);
    await describeCure(monster, cure, visible, state, publish);
    consumeOneCure(monster, cure, state);

    if (acidic && !tinned && !monsterHasAcidResistance(monster)) {
        monster.mhp -= rollOne(15);
        if (visible) {
            await publish(
                `${monsterSubject(monster)} has a very bad case of stomach acid.`,
            );
        }
        if (monster.mhp <= 0) {
            if (visible) await publish(`${monsterSubject(monster)} dies!`);
            if (typeof finishDeath !== 'function') {
                throw new TypeError(
                    'a fatal stoning cure requires a monster death function',
                );
            }
            await finishDeath(monster, { noCorpse: false });
            return { consumed: true, cure, died: true };
        }
    }

    if (visible) {
        const hallucinating = state.u?.hallucinating
            || (state.u?.hallucinationTurns ?? 0) > 0;
        const subject = monsterSubject(monster);
        await publish(hallucinating
            ? `What a pity - ${subject.toLowerCase()} just ruined `
                + 'a future piece of art!'
            : `${subject} seems limber!`);
    }
    if (lizard && (monster.mconf || monster.mstun)) {
        monster.mconf = 0;
        monster.mstun = 0;
        const name = MONSTER_NAME[monster.mnum];
        if (visible && name !== 'bat' && monster.mnum !== PM_STALKER)
            await publish(`${monsterSubject(monster)} seems steadier now.`);
    }
    if (monster.mtame && !monster.isminion && nutrition > 0) {
        const dog = monster.edog || (monster.edog = {});
        dog.hungrytime = Math.max(
            dog.hungrytime ?? 0, state.moves ?? 0,
        ) + nutrition;
        monster.mconf = 0;
    }
    monster.movement = (monster.movement ?? 0) - NORMAL_SPEED;
    monster.mlstmv = state.moves ?? 0;
    return { consumed: true, cure, died: false };
}
