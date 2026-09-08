import { CORPSE, LARGE_BOX } from '../../js/object_data.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import { addObjectToContainer } from '../../js/object_container.js';
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
    const { observed = true, ...properties } = overrides;
    return addInventoryItem(
        knownObject(otyp, properties), null, observed,
    );
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

export function chargedWand(otyp, { charges = 3, ...overrides } = {}) {
    return knownObject(otyp, {
        initialize: false,
        invlet: 'a',
        where: 'inventory',
        spe: charges,
        ...overrides,
    });
}

export function corpseObject(species, overrides = {}) {
    const corpse = mksobj(CORPSE, true, false);
    set_corpsenm(corpse, species);
    Object.assign(corpse, overrides);
    corpse.owt = objectWeight(corpse);
    return corpse;
}

export function untimedCorpse(species, overrides = {}) {
    const corpse = corpseObject(species, overrides);
    stopAllObjectTimers(corpse);
    return corpse;
}

export function unopenedCatBox(overrides = {}) {
    const box = uninitializedObject(LARGE_BOX, {
        spe: 1, cknown: false, olocked: false, otrapped: false, ...overrides,
    });
    addObjectToContainer(box, untimedCorpse(MONSTER_NAME.indexOf('housecat')));
    box.owt = objectWeight(box);
    return box;
}
