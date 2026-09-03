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
    MONSTER_NAME, MONSTER_SIZE, monsterIsShade, monsterIsUndead,
    monsterIsVampireShifter,
} from './monster_data.js';
import {
    ACID_VENOM, BLINDING_VENOM, CLOVE_OF_GARLIC, CORPSE, CREAM_PIE, EGG,
    MIRROR, OBJECT_MATERIAL,
} from './object_data.js';
import { objectBreaksOnImpact } from './object_breakage.js';
import { deleteObject } from './object_delete.js';
import { rnd, rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { objectWeight } from './weight.js';

const BLINDING_OBJECTS = new Set([CREAM_PIE, BLINDING_VENOM]);
const VEGGY = 3;
const PAPER = 5;
const SPBOOK_CLASS = 10;

export async function resolveHeroMeleeObjectContact(
    monster,
    object,
    {
        state = game,
        rollOne = rnd,
        random = rn2,
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

    if (object?.otyp === MIRROR) {
        if (!objectBreaksOnImpact(object, random)) return { damage: 1 };

        await publish("You break your mirror. That's bad luck!");
        state.u.uluck = Math.max(
            -13, Math.min(13, (state.u?.uluck ?? 0) - 2),
        );
        consumeOneWieldedObject(object, state);
        return {
            damage: 1,
            addHeroDamageBonuses: false,
            specialMessage: true,
        };
    }

    if (object?.otyp === CORPSE && !touchPetrifies(object.corpsenm)) {
        if (monsterIsShade(monster)) {
            return { damage: 0, addHeroDamageBonuses: false };
        }
        const corpseSize = MONSTER_SIZE[object.corpsenm] ?? 0;
        return { damage: corpseSize + 1 };
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

    const material = OBJECT_MATERIAL[object?.otyp];
    const tooSoftToHurt = !BLINDING_OBJECTS.has(object?.otyp)
        && object?.otyp !== EGG
        && object?.oclass !== SPBOOK_CLASS
        && (material === VEGGY || material === PAPER);
    if (tooSoftToHurt) {
        return { damage: 0, addHeroDamageBonuses: false };
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
