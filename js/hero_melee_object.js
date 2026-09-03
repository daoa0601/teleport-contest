// Effects of a non-weapon wielded by the hero.
// C ref: uhitm.c hmon_hitmon_misc_obj().

import {
    applyMonsterBlindness, heroBlindingObjectHitMessage,
    monsterCanBeBlindedByObject,
} from './blinding_attack.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { angerAttackedMonster } from './monster_anger.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterHasAcidResistance } from './monster_resistance.js';
import {
    MONSTER_NAME, monsterIsShade, monsterIsUndead, monsterIsVampireShifter,
} from './monster_data.js';
import {
    ACID_VENOM, BLINDING_VENOM, CLOVE_OF_GARLIC, CREAM_PIE,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { rnd } from './rng.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { objectWeight } from './weight.js';

const BLINDING_OBJECTS = new Set([CREAM_PIE, BLINDING_VENOM]);

export async function resolveHeroMeleeObjectContact(
    monster,
    object,
    {
        state = game,
        rollOne = rnd,
        publish = plineWithContinuation,
        describeTarget = () => monster.name
            || `the ${MONSTER_NAME[monster.mnum] || 'monster'}`,
    } = {},
) {
    if (object?.otyp === CLOVE_OF_GARLIC) {
        if (monsterIsUndead(monster.mnum)
            || monsterIsVampireShifter(monster)) {
            await makeMonsterFlee(monster, {
                state,
                turns: rollOne(4) + rollOne(4),
                publish,
            });
        }
        return { damage: 1 };
    }

    if (object?.otyp === ACID_VENOM) {
        if (monsterIsShade(monster)) {
            return { damage: 0, addHeroDamageBonuses: false };
        }

        const resisted = monsterHasAcidResistance(monster);
        await publish(resisted
            ? `Your venom hits ${describeTarget()} harmlessly.`
            : `Your venom burns ${describeTarget()}!`);
        const damage = resisted ? 0 : rollPhysicalWeaponDamage(
            object, monster, { rollOne },
        );
        consumeOneWieldedObject(object, state);
        return {
            damage,
            addHeroDamageBonuses: false,
            specialMessage: true,
        };
    }

    if (!BLINDING_OBJECTS.has(object?.otyp)) return null;
    if (monsterIsShade(monster)) {
        return { damage: 0, addHeroDamageBonuses: false };
    }

    monster.msleeping = 0;
    const canBlind = monsterCanBeBlindedByObject(monster, object.otyp, {
        heroInsideTarget: !!state.u?.uswallow
            && state.u?.ustuck === monster,
        state,
    });
    await publish(heroBlindingObjectHitMessage(monster, object, {
        canBlind,
        state,
        describeTarget,
    }));

    await angerAttackedMonster(monster);
    if (canBlind) applyMonsterBlindness(monster, rollOne);
    consumeOneWieldedObject(object, state);
    return {
        damage: 0,
        addHeroDamageBonuses: false,
        specialMessage: true,
    };
}

function consumeOneWieldedObject(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity > 1) {
        object.quan = object.quantity = quantity - 1;
        object.owt = objectWeight(object);
    } else {
        releaseWeaponSlots(object, state);
        deleteObject(object, state);
    }
    state._capacityDirty = true;
}
