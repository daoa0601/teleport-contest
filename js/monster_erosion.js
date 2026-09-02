// Acid and corrosion damage to a monster's carried equipment.
// C refs: trap.c acid_damage()/erode_obj() and uhitm.c erode_armor().

import { canProjectMonster } from './display.js';
import { game } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    OBJECT_MATERIAL, OBJECT_NAMES, SCR_BLANK_PAPER,
} from './object_data.js';
import { rnl, rn2 } from './rng.js';
import {
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
} from './const.js';

const SCROLL_CLASS = 9;

export async function damageMonsterObjectWithAcid(
    monster,
    object,
    {
        state = game,
        publish = async () => undefined,
        random = rn2,
        luckRandom = rnl,
    } = {},
) {
    if (!object) return { result: 'nothing' };
    const visible = monsterIsVisible(monster, state);
    const subject = monsterSubject(monster);
    const name = objectName(object);

    if (object.greased) {
        if (visible) {
            await publish(
                `${subject}'s ${name} is protected by the layer of grease!`,
            );
        }
        if (random(2) === 0) object.greased = false;
        return { result: 'greased' };
    }

    if (object.oclass === SCROLL_CLASS
        && object.otyp !== SCR_BLANK_PAPER) {
        if (visible && !state.blind)
            await publish(`${subject}'s ${name} fades.`);
        object.otyp = SCR_BLANK_PAPER;
        object.spe = 0;
        object.dknown = false;
        if (object.name) object.name = 'scroll of blank paper';
        if (object.plural) object.plural = 'scrolls of blank paper';
        return { result: 'erased' };
    }

    return corrodeMonsterObject(
        monster, object, true,
        { state, publish, random, luckRandom },
    );
}

export async function corrodeRandomMonsterArmor(
    monster,
    {
        state = game,
        publish = async () => undefined,
        random = rn2,
        luckRandom = rnl,
    } = {},
) {
    for (;;) {
        const selection = selectArmor(monster, random(5));
        if (!selection.object) {
            if (selection.bodySlot) return { result: 'nothing' };
            continue;
        }
        const result = await corrodeMonsterObject(
            monster,
            selection.object,
            selection.verbose,
            { state, publish, random, luckRandom },
        );
        if (selection.bodySlot || result.result !== 'nothing') return result;
    }
}

async function corrodeMonsterObject(
    monster, object, verbose,
    { state, publish, random, luckRandom },
) {
    const visible = monsterIsVisible(monster, state);
    const subject = monsterSubject(monster);
    const name = objectName(object);
    if (object.greased) {
        if (visible) {
            await publish(
                `${subject}'s ${name} is protected by the layer of grease!`,
            );
        }
        if (random(2) === 0) object.greased = false;
        return { result: 'greased' };
    }

    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const vulnerable = material === 11 || material === 13;
    const proof = !!(object.oerodeproof || object.corrodeproof);
    if (!vulnerable || proof && object.rknown) {
        if (verbose && visible) {
            await publish(
                `${subject}'s ${name} is not affected by corrosion.`,
            );
        }
        return { result: 'nothing' };
    }
    if (proof || object.blessed && luckRandom(4) === 0) {
        if (proof && visible) {
            await publish(
                `Somehow, ${lowercaseArticle(subject)}'s ${name} is not affected by the corrosion.`,
            );
        }
        if (proof) object.rknown = true;
        return { result: 'nothing' };
    }

    const oldErosion = object.oeroded2 ?? 0;
    if (oldErosion >= 3) {
        if (verbose && visible) {
            await publish(
                `${subject}'s ${name} looks completely corroded.`,
            );
        }
        return { result: 'nothing' };
    }
    object.oeroded2 = oldErosion + 1;
    if (visible) {
        const adverb = object.oeroded2 === 3
            ? ' completely' : oldErosion ? ' further' : '';
        await publish(`${subject}'s ${name} corrodes${adverb}!`);
    }
    return { result: 'damaged', object };
}

function selectArmor(monster, slot) {
    if (slot === 0) return wornArmor(monster, W_ARMH);
    if (slot === 1) {
        return {
            object: wornArmor(monster, W_ARMC).object
                || wornArmor(monster, W_ARM).object
                || wornArmor(monster, W_ARMU).object,
            bodySlot: true,
            verbose: true,
        };
    }
    if (slot === 2) return wornArmor(monster, W_ARMS);
    if (slot === 3) return wornArmor(monster, W_ARMG);
    return wornArmor(monster, W_ARMF);
}

function wornArmor(monster, mask) {
    const inventory = monster?.minvent || monster?.inventory || [];
    return {
        object: inventory.find(item => ((item.owornmask ?? 0) & mask) !== 0)
            || null,
        bodySlot: false,
        verbose: false,
    };
}

function monsterIsVisible(monster, state) {
    return state === game
        && canProjectMonster(monster, monster.mx, monster.my);
}

function monsterSubject(monster) {
    return monster.name || `The ${MONSTER_NAME[monster.mnum] || 'monster'}`;
}

function lowercaseArticle(subject) {
    return subject.startsWith('The ')
        ? `the ${subject.slice(4)}`
        : subject;
}

function objectName(object) {
    if (object.name || object.description)
        return object.name || object.description;
    const baseName = OBJECT_NAMES[object.otyp] || 'object';
    return object.oclass === SCROLL_CLASS ? `scroll of ${baseName}` : baseName;
}
