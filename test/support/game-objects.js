import { CORPSE, LARGE_BOX } from '../../js/object_data.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import { addCreatedObjectToContainer } from '../../js/object_container.js';
import { artifactByName } from '../../js/artifacts.js';
import { placeCreatedObject } from '../../js/floor_object.js';
import { mksobj, set_corpsenm } from '../../js/mklev.js';
import { stopAllObjectTimers } from '../../js/object_timers.js';
import { addInventoryItem } from '../../js/u_init.js';
import { objectWeight } from '../../js/weight.js';
export async function knownObject(otyp, overrides = {}) {
    const { initialize = true, ...properties } = overrides;
    const quantity = properties.quan ?? properties.quantity ?? 1;
    const object = await mksobj(otyp, initialize, false);
    const configured = {
        ...object,
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        known: true,
        typeKnown: true,
        ...properties,
        quan: quantity,
        quantity,
    };
    copyObjectFixtureState(object, configured);
    if (properties.owt === undefined)
        object.owt = objectWeight(object);
    return object;
}
export async function uninitializedObject(otyp, overrides = {}) {
    return await knownObject(otyp, {
        initialize: false,
        ...overrides,
    });
}
export async function artifactObject(name, overrides = {}) {
    const artifact = artifactByName(name);
    if (!artifact)
        throw new Error(`Unknown artifact: ${name}`);
    return await uninitializedObject(artifact.baseType, {
        oartifact: artifact.id,
        oextra: { oname: artifact.name },
        ...overrides,
    });
}
export async function addInventoryObject(otyp, overrides = {}) {
    const { observed = true, ...properties } = overrides;
    const object = await addInventoryItem(await knownObject(otyp, properties), null, observed);
    requireInventoryLetter(object);
    return object;
}
export async function addInventoryWeapon(otyp, overrides = {}) {
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
export async function floorObject(otyp, x, y, overrides = {}) {
    return placeCreatedObject(await knownObject(otyp, {
        where: 'free',
        ...overrides,
    }), x, y);
}
export async function floorArtifact(name, x, y, overrides = {}) {
    return placeCreatedObject(await artifactObject(name, overrides), x, y);
}
export async function chargedWand(otyp, { charges = 3, ...overrides } = {}) {
    return await knownObject(otyp, {
        initialize: false,
        invlet: 'a',
        where: 'inventory',
        spe: charges,
        ...overrides,
    });
}
export async function corpseObject(species, overrides = {}) {
    const corpse = await mksobj(CORPSE, true, false);
    set_corpsenm(corpse, species);
    const configured = { ...corpse, ...overrides };
    copyObjectFixtureState(corpse, configured);
    corpse.owt = objectWeight(corpse);
    return corpse;
}
export async function untimedCorpse(species, overrides = {}) {
    const corpse = await corpseObject(species, overrides);
    stopAllObjectTimers(corpse);
    return corpse;
}
export async function unopenedCatBox(overrides = {}) {
    const box = await uninitializedObject(LARGE_BOX, {
        spe: 1, cknown: false, olocked: false, otrapped: false, ...overrides,
    });
    await addCreatedObjectToContainer(box, await untimedCorpse(MONSTER_NAME.indexOf('housecat')));
    box.owt = objectWeight(box);
    return box;
}
function requireInventoryLetter(object) {
    if (!object.invlet)
        throw new Error('The inventory fixture needs a real selection letter');
}
// Object timers and ownership links refer to the constructed instance. Keep
// that identity while applying a fully checked object state to its own fields.
function copyObjectFixtureState(target, source) {
    for (const key in source)
        if (Object.hasOwn(source, key))
            target[key] = source[key];
}
//# sourceMappingURL=game-objects.js.map