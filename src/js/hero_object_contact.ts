import { changeHeroLuck } from './attrib.js';
// C uhitm.c:hmon_hitmon_potion() and hmon_hitmon_misc_obj(). This phase
// resolves the object's own effects; hmon owns bonuses and remaining damage.
import {
    applyMonsterBlindness, heroBlindingObjectHitMessage, monsterCanBeBlindedByObject,
} from './blinding_attack.js';
import { releaseCameraDemon } from './camera.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { dist2 } from './hacklib.js';
import { resolveHeroEggHit } from './hero_egg_hit.js';
import { freeInventoryObject } from './hero_inventory.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { consumeInventoryItem } from './invent.js';
import { angerAttackedMonster, wakeAttackedMonster } from './monster_anger.js';
import {
    MONSTER_NAME, MONSTER_SIZE, monsterHatesBlessings, monsterHatesSilver,
    monsterIsShade, monsterIsUndead, monsterIsVampireShifter,
} from './monster_data.js';
import { makeMonsterFlee } from './monster_flee.js';
import { monsterName } from './monster_name.js';
import { monsterHasAcidResistance, monsterHasStoneResistance } from './monster_resistance.js';
import { petrifyMonsterFromContact } from './monster_stoning.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { objectBreaksOnImpact } from './object_breakage.js';
import {
    ACID_VENOM, BLINDING_VENOM, BOULDER, CLOVE_OF_GARLIC, CORPSE, CREAM_PIE,
    EGG, EXPENSIVE_CAMERA, HEAVY_IRON_BALL, IRON_CHAIN, MIRROR, TOWEL,
} from './object_data.js';
import { deleteObject } from './object_delete.js';
import { unlinkObject } from './object_location.js';
import { observeObject } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { objectQuantity, splitObjectStack } from './object_stack.js';
import { corpseName, objectName, pluralizeObjectNoun } from './objnam.js';
import { hitMonsterWithSupportedPotion } from './potion_hit.js';
import { rnd, rn2 } from './rng.js';
import { carriedObjectOwner } from './shk.js';
import { touchPetrifies } from './stoning.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { rollPhysicalWeaponDamage } from './weapon_damage.js';
import { objectWeight } from './weight.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { FinishHeroMonsterDeath } from './hero_monster_death.js';
import type { HeroPhysicalAttackMode } from './hero_physical_types.js';
import type { Position } from './map_types.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';

export interface HeroObjectContactOptions {
    mode: HeroPhysicalAttackMode;
    state?: GameState;
    target?: Position;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    finishMonsterDeath?: FinishHeroMonsterDeath;
}

export interface HeroObjectContactEffects {
    damage: number;
    getDamageBonus: boolean;
    specialMessage: boolean;
    dryTowel: boolean;
    silverContact: boolean;
    objectConsumed: boolean;
    heroDied: boolean;
}

export type HeroObjectContactResult = HeroObjectContactEffects & (
    | { done: false; survived?: never }
    | { done: true; survived: boolean }
);

const VEGGY = 3;
const PAPER = 5;
const POTION_CLASS = 8;
const SPBOOK_CLASS = 10;
const SILVER = 14;
const PHYSICAL_OBJECTS = new Set([BOULDER, HEAVY_IRON_BALL, IRON_CHAIN]);
const SHADE_AWARE_OBJECTS = new Set([...PHYSICAL_OBJECTS, MIRROR, CLOVE_OF_GARLIC]);

export async function resolveHeroObjectContact(
    monster: Monster, object: GameObject, {
        mode, state = game, target = { x: monster.mx, y: monster.my },
        publish = plineWithContinuation, random = rn2, rollOne = rnd,
        finishMonsterDeath = (victim, death) => finishHeroMonsterKillOutcome(victim, victim.mx, victim.my, death),
    }: HeroObjectContactOptions,
): Promise<HeroObjectContactResult> {
    requirePlayingGame(state);
    const contact: HeroObjectContactResult = {
        done: false, damage: 0, getDamageBonus: true, specialMessage: false,
        dryTowel: false, silverContact: false, objectConsumed: false, heroDied: false,
    };
    if (object.oclass === POTION_CLASS) {
        const potion = await detachContactPotion(object, state);
        const impact = await hitMonsterWithSupportedPotion({
            state, monster, potion, target, publish, finishKill: finishMonsterDeath,
            wakeMonster: wakeAttackedMonster,
            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, state, publish),
            resolveVapor: true,
            distance: dist2(state.u.ux, state.u.uy, monster.mx, monster.my),
        });
        if (!impact) throw new Error(`Potion contact has no effect owner for object type ${potion.otyp}`);
        contact.objectConsumed = consumedIdentity(object);
        contact.heroDied = !!impact.heroDied;
        if (contact.heroDied || monster.dead || monster.mhp <= 0)
            return { ...contact, done: true, survived: !monster.dead && monster.mhp > 0 };
        contact.damage = monsterIsShade(monster) ? 0 : 1;
        contact.specialMessage = true;
        return contact;
    }
    if (monsterIsShade(monster) && !objectCanTouchShade(object, state)) return contact;

    switch (object.otyp) {
    case BOULDER: case HEAVY_IRON_BALL: case IRON_CHAIN:
        contact.damage = rollPhysicalWeaponDamage(object, monster, { rollOne });
        break;
    case MIRROR:
        if (objectBreaksOnImpact(object, random)) {
            await publish(`You break ${ownedSimpleName(object, state)}.  That's bad luck!`);
            changeHeroLuck(-2, state);
            await consumeContactObject(object, state, false);
            contact.getDamageBonus = false;
            contact.specialMessage = true;
        }
        contact.damage = 1;
        break;
    case EXPENSIVE_CAMERA:
        await publish(`You succeed in destroying ${ownedSimpleName(object, state)}.  Congratulations!`);
        await releaseCameraDemon(object, state.u.ux, state.u.uy, { state, publish, random });
        await consumeContactObject(object, state, false);
        return {
            ...contact, done: true, survived: true,
            objectConsumed: consumedIdentity(object), heroDied: !!state.program_state.gameover,
        };
    case CORPSE:
        if (touchPetrifies(object.corpsenm)) {
            await publish(`You hit ${monsterName(monster, { state })} with ${corpseName(object, {
                definite: !!object.dknown, includeArticle: !object.dknown,
            })}.`);
            observeObject(object, state);
            contact.damage = 1;
            contact.specialMessage = true;
            const petrification = await petrifyMonsterFromContact(monster, {
                state, publish, rollOne, creditHero: true,
                finishDeath: (victim, death) => finishMonsterDeath(victim, {
                    ...death, showKillMessage: false, recordConduct: !death?.noCorpse,
                }),
            });
            if (petrification.heroDied) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
            if (!monsterHasStoneResistance(monster))
                return { ...contact, done: true, survived: petrification.survived };
        } else contact.damage = (object.corpsenm === undefined ? 0 : MONSTER_SIZE[object.corpsenm] ?? 0) + 1;
        break;
    case EGG:
        return resolveHeroEggHit(monster, object, { state, mode, publish, random, rollOne, finishMonsterKill: finishMonsterDeath });
    case CLOVE_OF_GARLIC:
        if (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster)) {
            const flight = await makeMonsterFlee(monster, { state, turns: rollOne(4) + rollOne(4), publish, random, rollOne });
            if (flight.heroDied) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
        }
        contact.damage = 1;
        break;
    case CREAM_PIE: case BLINDING_VENOM: {
        monster.msleeping = 0;
        const canBlind = monsterCanBeBlindedByObject(monster, object.otyp, { state, heroInsideTarget: !!state.u.uswallow });
        await publish(heroBlindingObjectHitMessage(monster, object, {
            canBlind, state, thrown: mode !== 'melee',
            describeTarget: () => monsterName(monster, { state }),
        }));
        await angerAttackedMonster(monster);
        if (state.program_state.gameover) return { ...contact, done: true, survived: monster.mhp > 0, heroDied: true };
        if (canBlind) applyMonsterBlindness(monster, random(25) + 21);
        await consumeContactObject(object, state, mode !== 'melee');
        contact.getDamageBonus = false;
        contact.specialMessage = true;
        break;
    }
    case ACID_VENOM:
        if (monsterHasAcidResistance(monster)) {
            await publish(`Your venom hits ${monsterName(monster, { state })} harmlessly.`);
        } else {
            await publish(`Your venom burns ${monsterName(monster, { state })}!`);
            contact.damage = rollPhysicalWeaponDamage(object, monster, { rollOne });
        }
        await consumeContactObject(object, state, mode !== 'melee');
        contact.getDamageBonus = false;
        contact.specialMessage = true;
        break;
    default: {
        const material = objectMaterial(object, state);
        if ((material === VEGGY || material === PAPER) && object.oclass !== SPBOOK_CLASS) {
            contact.getDamageBonus = false;
            break;
        }
        const range = Math.ceil(object.owt / 100);
        contact.damage = Math.min(6, range <= 1 ? 1 : rollOne(range));
        if (object.otyp === TOWEL && object.spe > 0) {
            contact.damage += object.spe * (MONSTER_NAME[monster.mnum] === 'iron golem' ? 2 : 1);
            contact.damage = rollOne(contact.damage);
            contact.dryTowel = random(object.spe + 1) > 0;
        }
        if (material === SILVER && monsterHatesSilver(monster)) {
            contact.damage += rollOne(20);
            contact.silverContact = true;
        }
        if (object.blessed && monsterHatesBlessings(monster)) contact.damage += rollOne(4);
        break;
    }
    }
    contact.objectConsumed = consumedIdentity(object);
    contact.heroDied = !!state.program_state.gameover;
    return contact;
}

export function objectCanTouchShade(object: GameObject | null | undefined, state: GameState = game): boolean {
    return !!object && (SHADE_AWARE_OBJECTS.has(object.otyp) || objectMaterial(object, state) === SILVER);
}

function consumedIdentity(object: GameObject): boolean {
    return object.where === 'gone' || object.where === 'onbill';
}

function ownedSimpleName(object: GameObject, state: GameState): string {
    const owner = carriedObjectOwner(object, state);
    const name = objectName(object, state, { minimal: true });
    return `${owner === 'Your' || owner === 'The' ? owner.toLowerCase() : owner} ${objectQuantity(object) === 1
        ? name : pluralizeObjectNoun(object, name)}`;
}

async function consumeContactObject(object: GameObject, state: GameState, all: boolean): Promise<void> {
    if (all) {
        await deleteObject(object, state);
    } else if (object.where === 'inventory') {
        await consumeInventoryItem(object, state);
    } else if (objectQuantity(object) > 1) {
        object.quan = object.quantity = objectQuantity(object) - 1;
        object.owt = objectWeight(object);
    } else await deleteObject(object, state);
}

async function detachContactPotion(object: GameObject, state: GameState): Promise<GameObject> {
    let potion = object;
    if (objectQuantity(object) > 1) {
        const split = splitObjectStack(object, 1, state);
        if (!split) throw new Error('Potion contact could not separate one bottle');
        potion = split;
    } else await releaseWeaponSlots(potion, state);
    if (potion.where === 'inventory') await freeInventoryObject(potion, state);
    else unlinkObject(potion, state);
    potion.invlet = null;
    return potion;
}
