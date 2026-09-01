import {
    OBJECT_BASES, OBJECT_NAMES,
} from '../../js/object_data.js';

function objectClass(otyp) {
    for (let oclass = 2; oclass < OBJECT_BASES.length - 1; oclass++) {
        if (otyp >= OBJECT_BASES[oclass] && otyp < OBJECT_BASES[oclass + 1])
            return oclass;
    }
    return 1;
}

export function carriedObject(otyp, overrides = {}) {
    return {
        otyp,
        name: OBJECT_NAMES[otyp],
        oclass: objectClass(otyp),
        invlet: 'a',
        quan: 1,
        quantity: 1,
        where: 'inventory',
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

export function chargedWand(otyp, { charges = 3, ...overrides } = {}) {
    return carriedObject(otyp, {
        spe: charges,
        charges: { current: charges, recharged: 0 },
        ...overrides,
    });
}
