// Effects of a non-weapon wielded by the hero.
// C ref: uhitm.c hmon_hitmon_misc_obj().

import {
    applyMonsterBlindness, heroBlindingObjectHitMessage,
    monsterCanBeBlindedByObject,
} from './blinding_attack.js';
import { releaseCameraDemon } from './camera.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { dist2 } from './hacklib.js';
import { resolveHeroEggHit } from './hero_egg_hit.js';
import { angerAttackedMonster } from './monster_anger.js';
import {
    MONSTER_NAME, MONSTER_SIZE, monsterHatesBlessings, monsterHatesSilver,
    monsterIsAmorphous, monsterIsNoncorporeal, monsterIsShade,
    monsterIsUndead, monsterIsVampireShifter,
} from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import {
    monsterHasAcidResistance, monsterHasStoneResistance,
} from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { recordObjectEncounter } from './object_knowledge.js';
import {
    ACID_VENOM, BLINDING_VENOM, BOULDER, CLOVE_OF_GARLIC, CORPSE,
    CREAM_PIE, EGG, EXPENSIVE_CAMERA, HEAVY_IRON_BALL, IRON_CHAIN, MIRROR,
    OBJECT_MATERIAL, OBJECT_NAMES, TOWEL,
} from './object_data.js';
import { objectBreaksOnImpact } from './object_breakage.js';
import { deleteObject } from './object_delete.js';
import { splitObjectStack } from './object_stack.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { rnd, rn2 } from './rng.js';
import { touchPetrifies } from './stoning.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { objectWeight } from './weight.js';

const BLINDING_OBJECTS = new Set([CREAM_PIE, BLINDING_VENOM]);
const VEGGY = 3;
const PAPER = 5;
const POTION_CLASS = 8;
const SPBOOK_CLASS = 10;
const SILVER = 14;
const PHYSICAL_DAMAGE_OBJECTS = new Set([
    BOULDER, HEAVY_IRON_BALL, IRON_CHAIN,
]);
const SHADE_AWARE_OBJECTS = new Set([
    ...PHYSICAL_DAMAGE_OBJECTS, MIRROR, CLOVE_OF_GARLIC,
]);
const PM_IRON_GOLEM = MONSTER_NAME.indexOf('iron golem');

function objectCanTouchShade(object) {
    return SHADE_AWARE_OBJECTS.has(object?.otyp)
        || OBJECT_MATERIAL[object?.otyp] === SILVER;
}

function possessive(name) {
    return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function silverSearingMessage(monster, object, describeTarget) {
    const target = describeTarget();
    if (target === 'it') return 'It is seared!';

    const flesh = monsterIsNoncorporeal(monster)
        || monsterIsAmorphous(monster) ? target : `${possessive(target)} flesh`;
    const quantity = object.quan ?? object.quantity ?? 1;
    let objectName = quantity > 1
        ? object.plural || `${OBJECT_NAMES[object.otyp] || 'object'}s`
        : object.name || OBJECT_NAMES[object.otyp] || 'object';
    if (!objectName.toLowerCase().includes('silver'))
        objectName = `silver ${objectName}`;
    return `Your ${objectName} ${quantity > 1 ? 'sear' : 'sears'} ${flesh}!`;
}

function weightedObjectContact(monster, object, {
    describeTarget, random, rollOne,
}) {
    if (PHYSICAL_DAMAGE_OBJECTS.has(object.otyp)) {
        return {
            damage: rollPhysicalWeaponDamage(object, monster, { rollOne }),
        };
    }

    const weight = object.owt ?? objectWeight(object);
    const range = Math.ceil(weight / 100);
    let damage = range <= 1 ? 1 : rollOne(range);
    damage = Math.min(damage, 6);

    let dryTowel = false;
    const wetness = object.otyp === TOWEL ? object.spe ?? 0 : 0;
    if (wetness > 0) {
        damage += wetness * (monster.mnum === PM_IRON_GOLEM ? 2 : 1);
        damage = rollOne(damage);
        dryTowel = random(wetness + 1) > 0;
    }

    const silverSears = OBJECT_MATERIAL[object.otyp] === SILVER
        && monsterHatesSilver(monster);
    if (silverSears) damage += rollOne(20);
    if (object.blessed && monsterHatesBlessings(monster))
        damage += rollOne(4);

    return {
        damage,
        dryTowel,
        silverMessage: silverSears
            ? silverSearingMessage(monster, object, describeTarget) : null,
    };
}

function detachWieldedPotion(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity > 1) {
        const potion = splitObjectStack(object, 1, state);
        potion.invlet = null;
        potion.where = 'free';
        state._capacityDirty = true;
        return potion;
    }

    releaseWeaponSlots(object, state);
    const index = state.inventory?.indexOf(object) ?? -1;
    if (index >= 0) state.inventory.splice(index, 1);
    object.invlet = null;
    object.where = 'free';
    state._capacityDirty = true;
    return object;
}

async function resolveWieldedPotionHit(monster, object, {
    state,
    publish,
    wakeMonster,
    wakeNearby,
    finishMonsterDeath,
}) {
    const potion = detachWieldedPotion(object, state);
    const impact = await hitMonsterWithSupportedPotion({
        state,
        monster,
        potion,
        wakeMonster,
        wakeNearby,
        finishKill: finishMonsterDeath,
        publish,
        resolveVapor: true,
        distance: dist2(
            state.u?.ux ?? monster.mx,
            state.u?.uy ?? monster.my,
            monster.mx,
            monster.my,
        ),
    });
    if (!impact)
        throw new Error('unknown potion reached hero melee');

    const monsterSurvived = !monster.dead && (monster.mhp ?? 0) > 0;
    if (!monsterSurvived) {
        return {
            attackComplete: true,
            damage: 0,
            addHeroDamageBonuses: false,
            specialMessage: true,
            monsterSurvived: false,
        };
    }
    return {
        damage: monsterIsShade(monster) ? 0 : 1,
        specialMessage: true,
    };
}

export async function resolveHeroMeleeObjectContact(
    monster,
    object,
    {
        state = game,
        rollOne = rnd,
        random = rn2,
        publish = plineWithContinuation,
        finishMonsterDeath,
        wakeMonster,
        wakeNearby,
        describeTarget = () => monster.name
            || `the ${MONSTER_NAME[monster.mnum] || 'monster'}`,
    } = {},
) {
    if (object?.oclass === POTION_CLASS) {
        return resolveWieldedPotionHit(monster, object, {
            state,
            publish,
            wakeMonster,
            wakeNearby,
            finishMonsterDeath,
        });
    }

    if (monsterIsShade(monster) && !objectCanTouchShade(object)) {
        return { damage: 0, addHeroDamageBonuses: false };
    }

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

    if (object?.otyp === EXPENSIVE_CAMERA) {
        await publish(
            'You succeed in destroying your expensive camera. Congratulations!',
        );
        await releaseCameraDemon(object, state.u.ux, state.u.uy, {
            state, publish, random,
        });
        consumeOneWieldedObject(object, state);
        return {
            attackComplete: true,
            damage: 0,
            addHeroDamageBonuses: false,
            specialMessage: true,
            monsterSurvived: true,
        };
    }

    if (object?.otyp === CORPSE) {
        if (touchPetrifies(object.corpsenm)) {
            await publish(
                `You hit ${describeTarget()} with ${corpseContactName(object)}.`,
            );
            const hallucinating = !!(state.u?.hallucinating
                || (state.u?.hallucinationTurns ?? 0) > 0);
            if (!hallucinating) {
                object.dknown = true;
                recordObjectEncounter(CORPSE, state);
            }
            const petrification = await petrifyMonsterFromContact(monster, {
                creditHero: true,
                finishDeath: (target, death) => finishMonsterDeath(target, {
                    ...death,
                    showKillMessage: false,
                    recordConduct: false,
                }),
                publish,
                rollOne,
                state,
            });
            if (!monsterHasStoneResistance(monster)) {
                return {
                    attackComplete: true,
                    damage: 0,
                    addHeroDamageBonuses: false,
                    specialMessage: true,
                    monsterSurvived: petrification.survived,
                };
            }
            return { damage: 1, specialMessage: true };
        }
        const corpseSize = MONSTER_SIZE[object.corpsenm] ?? 0;
        return { damage: corpseSize + 1 };
    }

    if (object?.otyp === EGG) {
        return resolveHeroEggHit(monster, object, {
            state,
            publish,
            random,
            rollOne,
            finishMonsterKill: finishMonsterDeath,
            describeTarget,
        });
    }

    if (object?.otyp === ACID_VENOM) {
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
        && object?.oclass !== SPBOOK_CLASS
        && (material === VEGGY || material === PAPER);
    if (tooSoftToHurt) {
        return { damage: 0, addHeroDamageBonuses: false };
    }

    if (BLINDING_OBJECTS.has(object?.otyp)) {
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

    return weightedObjectContact(monster, object, {
        describeTarget, random, rollOne,
    });
}

export async function finishHeroMeleeObjectHit(object, contact, {
    state = game,
    publish = plineWithContinuation,
} = {}) {
    if (contact?.dryTowel) {
        const oldWetness = object.spe ?? 0;
        object.spe = Math.max(0, oldWetness - 1);
        if (state.uwep === object || state.u?.uwep === object)
            state._unweapon = object.spe === 0;
        const adjective = oldWetness < 3 ? 'moist ' : 'wet ';
        await publish(
            `Your ${adjective}towel dries${object.spe ? '' : ' out'}.`,
        );
    }
    if (contact?.silverMessage) await publish(contact.silverMessage);
}

function corpseContactName(corpse) {
    if (corpse.dknown === false) return 'a corpse';
    const species = MONSTER_NAME[corpse.corpsenm];
    return species ? `the ${species} corpse` : 'the corpse';
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
