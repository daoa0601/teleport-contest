import type { GameObject } from '../../js/object_types.js';
import { game } from '../../js/gstate.js';
import { recordObjectKnowledge } from '../../js/object_knowledge.js';
import { CORPSE, LARGE_BOX } from '../../js/object_data.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import { addCreatedObjectToContainer } from '../../js/object_container.js';
import { artifactByName } from '../../js/artifacts.js';
import { placeCreatedObject } from '../../js/floor_object.js';
import { mksobj, set_corpsenm } from '../../js/mklev.js';
import { stopAllObjectTimers } from '../../js/object_timers.js';
import { addInventoryItem } from '../../js/u_init.js';
import { objectWeight } from '../../js/weight.js';

export interface InventoryObject extends GameObject { invlet: string }

export type KnownObjectOverrides = Partial<GameObject> & { initialize?: boolean; typeKnown?: boolean };
export type InventoryObjectOverrides = KnownObjectOverrides & { observed?: boolean };


export async function knownObject(otyp: number, overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    const { initialize = true, typeKnown = true, ...properties } = overrides;
    const quantity = properties.quan ?? properties.quantity ?? 1;
    const object = await mksobj(otyp, initialize, false);
    // Knowing a type applies to every instance, even after this one changes.
    if (typeKnown) recordObjectKnowledge(otyp, game);
    const configured: GameObject = {
        ...object,
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        known: true,
        ...properties,
        quan: quantity,
        quantity,
    };
    copyObjectFixtureState(object, configured);
    if (properties.owt === undefined) object.owt = objectWeight(object);
    return object;
}

export async function uninitializedObject(otyp: number, overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    return await knownObject(otyp, {
        initialize: false,
        ...overrides,
    });
}

export async function artifactObject(name: string, overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    const artifact = artifactByName(name);
    if (!artifact) throw new Error(`Unknown artifact: ${name}`);
    return await uninitializedObject(artifact.baseType, {
        oartifact: artifact.id,
        oextra: { oname: artifact.name },
        ...overrides,
    });
}

export async function addInventoryObject(otyp: number, overrides: InventoryObjectOverrides = {}): Promise<InventoryObject> {
    const { observed = true, ...properties } = overrides;
    const object = await addInventoryItem(
        await knownObject(otyp, properties), null, observed,
    );
    // These fixtures represent existing possessions. Tests of acquisition
    // place objects on the floor and pick them up through the game command.
    object.pickup_prev = properties.pickup_prev ?? false;
    requireInventoryLetter(object);
    return object;
}

export async function addInventoryWeapon(otyp: number, overrides: InventoryObjectOverrides = {}): Promise<InventoryObject> {
    return await addInventoryObject(otyp, {
        quan: 1,
        quantity: 1,
        spe: 0,
        enchantment: 0,
        oeroded: 0,
        oeroded2: 0,
        ...overrides,
    });
}

export async function floorObject(otyp: number, x: number, y: number, overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    return placeCreatedObject(await knownObject(otyp, {
        where: 'free',
        ...overrides,
    }), x, y);
}

export async function floorArtifact(name: string, x: number, y: number, overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    return placeCreatedObject(await artifactObject(name, overrides), x, y);
}

export async function chargedWand(otyp: number, { charges = 3, ...overrides }: KnownObjectOverrides & { charges?: number } = {}): Promise<GameObject> {
    return await knownObject(otyp, {
        initialize: false,
        invlet: 'a',
        where: 'inventory',
        spe: charges,
        ...overrides,
    });
}

export async function corpseObject(species: number, overrides: Partial<GameObject> = {}): Promise<GameObject> {
    const corpse = await mksobj(CORPSE, true, false);
    set_corpsenm(corpse, species);
    const configured: GameObject = { ...corpse, ...overrides };
    copyObjectFixtureState(corpse, configured);
    corpse.owt = objectWeight(corpse);
    return corpse;
}

export async function untimedCorpse(species: number, overrides: Partial<GameObject> = {}): Promise<GameObject> {
    const corpse = await corpseObject(species, overrides);
    stopAllObjectTimers(corpse);
    return corpse;
}

export async function unopenedCatBox(overrides: KnownObjectOverrides = {}): Promise<GameObject> {
    const box = await uninitializedObject(LARGE_BOX, {
        spe: 1, cknown: false, olocked: false, otrapped: false, ...overrides,
    });
    await addCreatedObjectToContainer(box, await untimedCorpse(MONSTER_NAME.indexOf('housecat')));
    box.owt = objectWeight(box);
    return box;
}

function requireInventoryLetter(object: GameObject): asserts object is InventoryObject {
    if (!object.invlet) throw new Error('The inventory fixture needs a real selection letter');
}

// Object timers and ownership links refer to the constructed instance. Keep
// that identity while applying a fully checked object state to its own fields.
function copyObjectFixtureState<ObjectState extends GameObject>(
    target: ObjectState, source: NoInfer<ObjectState>,
): void {
    for (const key in source)
        if (Object.hasOwn(source, key)) target[key] = source[key];
}
