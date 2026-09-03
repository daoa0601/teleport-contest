import { CORPSE } from '../../js/object_data.js';
import { artifactByName } from '../../js/artifacts.js';
import { place_object } from '../../js/floor_object.js';
import { mksobj, set_corpsenm } from '../../js/mklev.js';
import { stopAllObjectTimers } from '../../js/object_timers.js';
import { addInventoryItem } from '../../js/u_init.js';
import { objectWeight } from '../../js/weight.js';

export function knownObject(otyp, overrides = {}) {
    const { initialize = true, ...properties } = overrides;
    const quantity = properties.quan ?? properties.quantity ?? 1;
    const object = Object.assign(mksobj(otyp, initialize, false), {
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        known: true,
        typeKnown: true,
        quan: quantity,
        quantity,
    }, properties, {
        quan: quantity,
        quantity,
    });
    if (properties.owt === undefined) object.owt = objectWeight(object);
    return object;
}

export function uninitializedObject(otyp, overrides = {}) {
    return knownObject(otyp, {
        initialize: false,
        ...overrides,
    });
}

export function artifactObject(name, overrides = {}) {
    const artifact = artifactByName(name);
    if (!artifact) throw new Error(`Unknown artifact: ${name}`);
    return uninitializedObject(artifact.baseType, {
        oartifact: artifact.id,
        oextra: { oname: artifact.name },
        ...overrides,
    });
}

export function addInventoryObject(otyp, overrides = {}) {
    return addInventoryItem(knownObject(otyp, overrides));
}

export function addInventoryWeapon(otyp, overrides = {}) {
    return addInventoryObject(otyp, {
        quan: 1,
        quantity: 1,
        spe: 0,
        enchantment: 0,
        oeroded: 0,
        oeroded2: 0,
        ...overrides,
    });
}

export function floorObject(otyp, x, y, overrides = {}) {
    return place_object(knownObject(otyp, {
        where: 'free',
        ...overrides,
    }), x, y);
}

export function floorArtifact(name, x, y, overrides = {}) {
    return place_object(artifactObject(name, overrides), x, y);
}

export function inventoryObject(otyp, invlet, overrides = {}) {
    return knownObject(otyp, {
        invlet,
        where: 'inventory',
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        owornmask: 0,
        ...overrides,
    });
}

export function chargedWand(otyp, { charges = 3, ...overrides } = {}) {
    return knownObject(otyp, {
        initialize: false,
        invlet: 'a',
        where: 'inventory',
        spe: charges,
        charges: { current: charges, recharged: 0 },
        ...overrides,
    });
}

export function untimedCorpse(species, overrides = {}) {
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, species);
    stopAllObjectTimers(corpse);
    return Object.assign(corpse, overrides);
}
