import {
    CLUB, DART, FLINT, LOADSTONE, OBJECT_BASES, OBJECT_NAMES, ROCK, SLING,
} from '../../js/object_data.js';
import { place_object } from '../../js/mklev.js';

const WEAPON_NAMES = new Map([
    [CLUB, ['club', 'clubs']],
    [DART, ['dart', 'darts']],
    [SLING, ['sling', 'slings']],
    [FLINT, ['flint stone', 'flint stones']],
    [LOADSTONE, ['loadstone', 'loadstones']],
    [ROCK, ['rock', 'rocks']],
]);

function objectClass(otyp) {
    for (let oclass = 2; oclass < OBJECT_BASES.length - 1; oclass++) {
        if (otyp >= OBJECT_BASES[oclass] && otyp < OBJECT_BASES[oclass + 1])
            return oclass;
    }
    return 1;
}

function testObject(otyp, overrides = {}) {
    return {
        otyp,
        name: OBJECT_NAMES[otyp],
        oclass: objectClass(otyp),
        quan: 1,
        quantity: 1,
        blessed: false,
        cursed: false,
        bknown: true,
        dknown: true,
        contents: [],
        objectTimers: [],
        timed: 0,
        ...overrides,
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

export function floorObject(otyp, x, y, overrides = {}) {
    return place_object(looseObject(otyp, overrides), x, y);
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
