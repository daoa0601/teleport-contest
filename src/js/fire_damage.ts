// Fire damage to object chains.
// C refs: trap.c fire_damage() and fire_damage_chain().

import { applyFloorEffects } from './floor_effects.js';
import { placeObject } from './floor_object.js';
import { game } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import { heroIsBlind } from './senses.js';
import { igniteItems } from './light.js';
import { delobj } from './object_delete.js';
import { objectResistsDestruction } from './object_state.js';
import { erodeObject } from './object_erosion.js';
import { objectClassForType } from './object_knowledge.js';
import { destroyObjectFromMonsterInventory } from './monster_inventory.js';
import {
    BAG_OF_TRICKS, CHEST, ICE_BOX, LARGE_BOX,
    POT_OIL,
    SCR_FIRE, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, STATUE,
} from './object_data.js';
import { rnl, rn2 } from './rng.js';
import { cansee, couldsee } from './vision.js';
import { definiteName, objectCombatName, ownedObjectName } from './objnam.js';

export interface FireDamageOptions {
    carrier?: Monster | null;
    force?: boolean;
    luckRandom?: typeof rnl;
    publish?: MessagePublisher;
    random?: typeof rn2;
    state?: GameState;
    x?: number;
    y?: number;
}

interface FireDamageContext {
    carrier: Monster | null;
    force: boolean;
    publish: MessagePublisher;
    random: typeof rn2;
    squareVisible: boolean;
    state: GameState;
    x: number;
    y: number;
}

const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;

function objectClass(object: GameObject) {
    return Number.isInteger(object?.oclass)
        ? object.oclass : objectClassForType(object?.otyp);
}

async function removeObject(object: GameObject, context: FireDamageContext) {
    const { carrier, state, random } = context;
    const inventory = carrier?.minvent || carrier?.inventory || [];
    if (carrier && inventory.includes(object)) {
        if (objectResistsDestruction(object, 0, 0, random)) return false;
        return destroyObjectFromMonsterInventory(carrier, object, state);
    }
    await delobj(object, state, random);
    return true;
}

async function dropContents(container: GameObject, context: FireDamageContext): Promise<void> {
    const contents = [...(container.contents || [])];
    container.contents = [];
    for (const object of contents) {
        object.container = null;
        object.where = 'free';
        const result = await applyFloorEffects(object, context.x, context.y, {
            state: context.state,
            publish: context.publish,
            random: context.random,
        });
        if (result.finished) continue;
        // Burned-container contents may include nested containers under
        // hero-caused fire: the awaited placement handles the charge path.
        await placeObject(object, context.x, context.y, context.state);
    }
}

async function burnContainer(object: GameObject, context: FireDamageContext): Promise<boolean> {
    if (object.otyp === STATUE || object.otyp === ICE_BOX) return false;
    const chance = object.otyp === CHEST ? 40
        : object.otyp === LARGE_BOX ? 30 : 20;
    if (!context.force
        && (context.state.u?.uluck ?? 0) + 5 > context.random(chance)) {
        return false;
    }
    if (context.squareVisible) {
        await context.publish(
            `${ownedObjectName(object, context.state)} catches fire and burns.`,
        );
    }
    if ((object.contents || []).length) {
        if (context.squareVisible)
            await context.publish('Its contents fall out.');
        await dropContents(object, context);
    }
    await removeObject(object, context);
    return true;
}

async function burnPaperOrPotion(object: GameObject, context: FireDamageContext): Promise<boolean> {
    const oclass = objectClass(object);
    if (oclass === SCROLL_CLASS || oclass === SPBOOK_CLASS) {
        if (object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
            return false;
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (context.squareVisible)
                await context.publish(`Smoke rises from ${definiteName(objectCombatName(object, {
                    state: context.state, includeCorpseSpecies: false,
                }), context.state)}.`);
            return false;
        }
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            const verb = oclass === SCROLL_CLASS && plural
                ? 'catch fire and burn' : 'catches fire and burns';
            await context.publish(
                `${ownedObjectName(object, context.state)} ${verb}.`,
            );
        }
    } else if (oclass === POTION_CLASS) {
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            let verb = plural ? 'boil and explode' : 'boils and explodes';
            if (object.otyp === POT_OIL)
                verb = plural ? 'ignite and explode' : 'ignites and explodes';
            await context.publish(
                `${ownedObjectName(object, context.state)} ${verb}.`,
            );
        }
    } else {
        return false;
    }
    await removeObject(object, context);
    return true;
}

// C fire_damage(): unlike the chain owner, this has no smoke epilogue.
export async function fireDamageObject(
    object: GameObject,
    {
        carrier = null,
        force = false,
        luckRandom = rnl,
        publish = async () => {},
        random = rn2,
        state = game,
        x = carrier?.mx ?? 0,
        y = carrier?.my ?? 0,
    }: FireDamageOptions = {},
): Promise<boolean> {
    const squareVisible = state === game
        && !heroIsBlind(state) && couldsee(x, y);
    const context: FireDamageContext = {
        carrier, force, publish, random,
        squareVisible, state, x, y,
    };

    const ignited = await igniteItems([object], {
        publish, random, state,
        visible: squareVisible,
    });
    if (ignited.length) return false;

    const container = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (container || object.otyp === STATUE)
        return burnContainer(object, context);
    if (!force
        && (state.u?.uluck ?? 0) + 5 > random(20)) {
        return false;
    }
    if (await burnPaperOrPotion(object, context)) return true;
    const erosion = await erodeObject(object, 'burn', {
        state, publish, random, luckRandom,
        destroy: true, position: { x, y },
    });
    return erosion === 'destroyed';
}

export async function fireDamageChain(
    objects: GameObject[] | null | undefined,
    {
        carrier = null,
        force = false,
        luckRandom = rnl,
        publish = async () => {},
        random = rn2,
        state = game,
        x = carrier?.mx ?? 0,
        y = carrier?.my ?? 0,
    }: FireDamageOptions = {},
): Promise<number> {
    if (!Array.isArray(objects)) return 0;

    let destroyed = 0;
    for (const object of [...objects]) {
        if (!await fireDamageObject(object, {
            carrier, force, luckRandom, publish, random, state, x, y,
        })) continue;
        destroyed++;
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
    }
    if (destroyed && heroIsBlind(state) && !couldsee(x, y))
        await publish('You smell smoke.');
    return destroyed;
}
