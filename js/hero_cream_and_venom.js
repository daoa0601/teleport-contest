// Cream pies and venom thrown by the hero.
// C refs: dothrow.c thitmonst() and uhitm.c hmon_hitmon_misc_obj().

import { currentAttribute } from './attrib.js';
import {
    applyMonsterBlindness, monsterCanBeBlindedByObject,
} from './blinding_attack.js';
import { A_DEX } from './const.js';
import {
    canProjectMonster, plineWithContinuation,
} from './display.js';
import { abusePetAfterHeroHit } from './dog.js';
import { game } from './gstate.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, monsterTypeName,
} from './monster_data.js';
import { monsterHasAcidResistance } from './monster_resistance.js';
import { deleteObject } from './object_delete.js';
import {
    ACID_VENOM, BLINDING_VENOM, CREAM_PIE,
} from './object_data.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind } from './senses.js';
import { prepareHeroThrownTarget } from './thrown_object.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';

const M1_NOEYES = 0x00001000;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const CREAM_AND_VENOM_TYPES = new Set([
    CREAM_PIE, BLINDING_VENOM, ACID_VENOM,
]);

export function isHeroThrownCreamOrVenom(object) {
    return CREAM_AND_VENOM_TYPES.has(object?.otyp);
}

function targetName(monster) {
    if (!canProjectMonster(monster, monster.mx, monster.my)) return 'it';
    return monster.name
        || `the ${monsterTypeName(monster.mnum, !!monster.female)}`;
}

function possessive(name) {
    if (name === 'it') return 'its';
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function creamPieTarget(monster) {
    const name = targetName(monster);
    const hasFace = !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
        && monster.mnum !== PM_FLOATING_EYE;
    return hasFace ? `${possessive(name)} face` : name;
}

function missName(object) {
    return object.otyp === CREAM_PIE ? 'cream pie' : 'splash of venom';
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
    const wasSeeing = !!monster.mcansee;
    let message = object.otyp === CREAM_PIE ? 'Splat!' : 'Splash!';
    if (canBlind && !heroIsBlind(state)) {
        message = object.otyp === CREAM_PIE
            ? `The cream pie splashes over ${creamPieTarget(monster)}!`
            : `The venom blinds ${targetName(monster)}${
                wasSeeing ? '' : ' further'
            }!`;
    }
    await publish(message);
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

export async function hitMonsterWithThrownCreamOrVenom(
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
    if (!isHeroThrownCreamOrVenom(object)) return null;

    prepareHeroThrownTarget(monster, random);
    rollOne(20);
    if (!guaranteedHit && currentAttribute(A_DEX, state) <= rollOne(25)) {
        await publish(`The ${missName(object)} misses ${targetName(monster)}.`);
        if (random(3) === 0) await wakeAttackedMonster(monster);
        return { hit: false, consumed: false, damage: 0, result: false };
    }

    if (object.otyp === ACID_VENOM) {
        return hitWithAcidVenom(
            monster, object, state, publish, rollOne, finishMonsterKill,
        );
    }
    return hitWithBlindingObject(monster, object, state, publish, rollOne);
}
