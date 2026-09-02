import {
    CLUB, CORPSE, DART, FLINT, LOADSTONE, OBJECT_NAMES, ROCK, SLING,
} from '../../js/object_data.js';
import { objectClassForType } from '../../js/object_knowledge.js';
import { artifactByName } from '../../js/artifacts.js';
import { mksobj, place_object, set_corpsenm } from '../../js/mklev.js';
import { stopAllObjectTimers } from '../../js/object_timers.js';
import { addInventoryItem } from '../../js/u_init.js';
import { objectWeight } from '../../js/weight.js';

const WEAPON_NAMES = new Map([
    [CLUB, ['club', 'clubs']],
    [DART, ['dart', 'darts']],
    [SLING, ['sling', 'slings']],
    [FLINT, ['flint stone', 'flint stones']],
    [LOADSTONE, ['loadstone', 'loadstones']],
    [ROCK, ['rock', 'rocks']],
]);

function testObject(otyp, overrides = {}) {
    const quantity = overrides.quan ?? overrides.quantity ?? 1;
    return {
        otyp,
        name: OBJECT_NAMES[otyp],
        oclass: objectClassForType(otyp),
        quan: quantity,
        quantity,
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        contents: [],
        objectTimers: [],
        timed: 0,
        ...overrides,
        quan: quantity,
        quantity,
    };
}

export function carriedObject(otyp, overrides = {}) {
    return testObject(otyp, {
        invlet: 'a',
        where: 'inventory',
        ...overrides,
    });
}

export function looseObject(otyp, overrides = {}) {
    return testObject(otyp, {
        where: 'free',
        ...overrides,
    });
}

export function artifactObject(name, overrides = {}) {
    const artifact = artifactByName(name);
    if (!artifact) throw new Error(`Unknown artifact: ${name}`);
    return testObject(artifact.baseType, {
        oartifact: artifact.id,
        oextra: { oname: artifact.name },
        ...overrides,
    });
}

export function knownObject(otyp, overrides = {}) {
    const quantity = overrides.quan ?? overrides.quantity ?? 1;
    const object = Object.assign(mksobj(otyp, true, false), {
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        known: true,
        typeKnown: true,
        quan: quantity,
        quantity,
    }, overrides, {
        quan: quantity,
        quantity,
    });
    if (overrides.owt === undefined) object.owt = objectWeight(object);
    return object;
}

export function knownInventoryObject(otyp, overrides = {}) {
    return addInventoryItem(knownObject(otyp, overrides));
}

export function knownInventoryWeapon(otyp, overrides = {}) {
    return knownInventoryObject(otyp, {
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
    return place_object(looseObject(otyp, overrides), x, y);
}

export function floorArtifact(name, x, y, overrides = {}) {
    return place_object(artifactObject(name, overrides), x, y);
}

export function inventoryObject(otyp, invlet, overrides = {}) {
    const [name, plural] = WEAPON_NAMES.get(otyp)
        || [OBJECT_NAMES[otyp], `${OBJECT_NAMES[otyp]}s`];
    return carriedObject(otyp, {
        invlet,
        name,
        plural,
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        owornmask: 0,
        ...overrides,
    });
}

export function chargedWand(otyp, { charges = 3, ...overrides } = {}) {
    return carriedObject(otyp, {
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
