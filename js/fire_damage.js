// Fire damage to object chains.
// C refs: trap.c fire_damage() and fire_damage_chain().

import { canProjectMonster } from './display.js';
import { IS_LAVA } from './const.js';
import { place_object } from './floor_object.js';
import { game } from './gstate.js';
import { heroIsBlind } from './senses.js';
import { igniteItems } from './light.js';
import { destroyLavaFloorObjects } from './trap.js';
import { deleteObject } from './object_delete.js';
import { objectClassForType } from './object_knowledge.js';
import { makePlural } from './object_grammar.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import { monsterTypeName } from './monster_data.js';
import {
    BAG_OF_TRICKS, CHEST, FIRE_HORN, ICE_BOX, LARGE_BOX,
    OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SUBTYPE, POT_OIL,
    RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_FIRE_RESISTANCE,
    SCR_FIRE, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, STATUE,
    TALLOW_CANDLE, WAN_FIRE, WAX_CANDLE,
} from './object_data.js';
import { rnl, rn2 } from './rng.js';
import { couldsee } from './vision.js';

const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const WOOD = 8;
const PLASTIC = 18;

const FIRE_RESISTANT_OBJECTS = new Set([
    RED_DRAGON_SCALE_MAIL,
    RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE,
]);
const PRIMARY_EROSION_CLASSES = new Set([
    WEAPON_CLASS,
    ARMOR_CLASS,
    BALL_CLASS,
    CHAIN_CLASS,
]);

function objectClass(object) {
    return Number.isInteger(object?.oclass)
        ? object.oclass : objectClassForType(object?.otyp);
}

function objectName(object) {
    if (object.otyp === SPE_BOOK_OF_THE_DEAD) return 'Book of the Dead';
    const baseName = object.name || OBJECT_NAMES[object.otyp] || 'object';
    let name = baseName;
    if (objectClass(object) === POTION_CLASS) name = `potion of ${baseName}`;
    else if (objectClass(object) === SCROLL_CLASS)
        name = `scroll of ${baseName}`;
    else if (objectClass(object) === SPBOOK_CLASS)
        name = `spellbook of ${baseName}`;
    return (object.quan ?? object.quantity ?? 1) > 1
        ? makePlural(name) : name;
}

function monsterName(monster) {
    return monster?.name
        || monsterTypeName(monster?.mnum, !!monster?.female);
}

function objectSubject(object, carrier) {
    const owner = carrier ? `The ${monsterName(carrier)}'s` : 'The';
    return `${owner} ${objectName(object)}`;
}

function objectCanBurn(object) {
    if ([TALLOW_CANDLE, WAX_CANDLE, FIRE_HORN, WAN_FIRE]
        .includes(object.otyp)
        || FIRE_RESISTANT_OBJECTS.has(object.otyp)) return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return (material > 1 && material <= WOOD) || material === PLASTIC;
}

function primaryErosionMatters(object) {
    const oclass = objectClass(object);
    return PRIMARY_EROSION_CLASSES.has(oclass)
        || oclass === TOOL_CLASS && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0;
}

function removeObject(object, carrier, state) {
    const inventory = carrier?.minvent || carrier?.inventory || [];
    if (inventory.includes(object))
        return destroyObjectFromMonsterInventory(carrier, object, state);
    return deleteObject(object, state);
}

async function dropContents(container, context) {
    const contents = [...(container.contents || [])];
    container.contents = [];
    for (const object of contents) {
        object.container = null;
        object.where = 'free';
        if (IS_LAVA(context.state.level?.at?.(
            context.x, context.y,
        )?.typ)) {
            const landed = [object];
            await destroyLavaFloorObjects(landed, {
                publish: context.publish,
                random: context.random,
                visible: context.squareVisible,
            });
            if (!landed.length) continue;
        }
        place_object(object, context.x, context.y, context.state);
    }
}

async function burnContainer(object, context) {
    if (object.otyp === STATUE || object.otyp === ICE_BOX) return false;
    const chance = object.otyp === CHEST ? 40
        : object.otyp === LARGE_BOX ? 30 : 20;
    if (!context.force
        && (context.state.u?.uluck ?? 0) + 5 > context.random(chance)) {
        return false;
    }
    if (context.squareVisible) {
        await context.publish(
            `${objectSubject(object, context.carrier)} catches fire and burns.`,
        );
    }
    if ((object.contents || []).length) {
        if (context.squareVisible)
            await context.publish('Its contents fall out.');
        await dropContents(object, context);
    }
    removeObject(object, context.carrier, context.state);
    return true;
}

async function burnPaperOrPotion(object, context) {
    const oclass = objectClass(object);
    if (oclass === SCROLL_CLASS || oclass === SPBOOK_CLASS) {
        if (object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
            return false;
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (context.squareVisible)
                await context.publish('Smoke rises from the Book of the Dead.');
            return false;
        }
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            const verb = oclass === SCROLL_CLASS && plural
                ? 'catch fire and burn' : 'catches fire and burns';
            await context.publish(
                `${objectSubject(object, context.carrier)} ${verb}.`,
            );
        }
    } else if (oclass === POTION_CLASS) {
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            let verb = plural ? 'boil and explode' : 'boils and explodes';
            if (object.otyp === POT_OIL)
                verb = plural ? 'ignite and explode' : 'ignites and explodes';
            await context.publish(
                `${objectSubject(object, context.carrier)} ${verb}.`,
            );
        }
    } else {
        return false;
    }
    removeObject(object, context.carrier, context.state);
    return true;
}

async function burnErodibleObject(object, context) {
    if (!primaryErosionMatters(object) || !objectCanBurn(object)) return false;
    if (object.oerodeproof && object.rknown) return false;
    if (object.oerodeproof
        || object.blessed && context.luckRandom(4) === 0) {
        if (object.oerodeproof) {
            object.rknown = true;
            if (context.carrierVisible) {
                const subject = objectSubject(object, context.carrier)
                    .replace(/^The /u, 'the ');
                await context.publish(
                    `Somehow, ${subject} is not affected by the heat.`,
                );
            }
        }
        return false;
    }

    const erosion = object.oeroded ?? 0;
    if (erosion < 3) {
        object.oeroded = erosion + 1;
        if (context.carrierVisible) {
            const suffix = object.oeroded === 3
                ? ' completely' : erosion ? ' further' : '';
            await context.publish(
                `${objectSubject(object, context.carrier)} smoulders${suffix}!`,
            );
        }
        return false;
    }
    if (context.carrierVisible) {
        await context.publish(
            `${objectSubject(object, context.carrier)} smoulders away!`,
        );
    }
    removeObject(object, context.carrier, context.state);
    return true;
}

async function fireDamageObject(object, context) {
    const ignited = await igniteItems([object], {
        carrierName: context.carrier ? monsterName(context.carrier) : null,
        publish: context.publish,
        random: context.random,
        state: context.state,
        visible: context.squareVisible,
    });
    if (ignited.length) return false;

    const container = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (container || object.otyp === STATUE)
        return burnContainer(object, context);
    if (!context.force
        && (context.state.u?.uluck ?? 0) + 5 > context.random(20)) {
        return false;
    }
    if (await burnPaperOrPotion(object, context)) return true;
    return burnErodibleObject(object, context);
}

export async function fireDamageChain(
    objects,
    {
        carrier = null,
        force = false,
        luckRandom = rnl,
        publish = async () => {},
        random = rn2,
        state = game,
        x = carrier?.mx ?? 0,
        y = carrier?.my ?? 0,
    } = {},
) {
    if (!Array.isArray(objects)) return 0;
    const squareVisible = state === game
        && !heroIsBlind(state) && couldsee(x, y);
    const carrierVisible = carrier
        ? state === game && canProjectMonster(carrier, x, y)
        : squareVisible;
    const context = {
        carrier, carrierVisible, force, luckRandom, publish, random,
        squareVisible, state, x, y,
    };

    let destroyed = 0;
    for (const object of [...objects]) {
        if (!await fireDamageObject(object, context)) continue;
        destroyed++;
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
    }
    if (destroyed && heroIsBlind(state) && !couldsee(x, y))
        await publish('You smell smoke.');
    return destroyed;
}
