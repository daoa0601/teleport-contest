import { game } from '../../js/gstate.js';
import { MONSTER_NAME } from '../../js/monster_data.js';

export function liveMonster({
    mnum,
    species,
    x,
    y,
    hitPoints = 20,
    level = 1,
    inventory: listedInventory,
    minvent,
    ...overrides
}) {
    const inventory = listedInventory ?? minvent ?? [];
    return {
        mnum: mnum ?? MONSTER_NAME.indexOf(species),
        mx: x,
        my: y,
        m_lev: level,
        mhp: hitPoints,
        mhpmax: hitPoints,
        mpeaceful: 0,
        mtame: 0,
        msleeping: 0,
        mcanmove: 1,
        mfrozen: 0,
        mcansee: 1,
        mstrategy: 0,
        minvent: inventory,
        inventory,
        ...overrides,
    };
}

export function deadMonster(options) {
    return liveMonster({
        ...options,
        mhp: 0,
    });
}

export function livePet(options) {
    return liveMonster({
        mpeaceful: 1,
        mtame: 10,
        pet: true,
        edog: {},
        ...options,
    });
}

export function deadPet(options) {
    return livePet({
        ...options,
        mhp: 0,
    });
}

function addToLevel(monster, state) {
    if (monster.m_id === undefined)
        monster.m_id = 1000 + state.level.monsters.length;
    state.level.monsters.push(monster);
    return monster;
}

export function addMonster(options, state = game) {
    return addToLevel(liveMonster(options), state);
}

export function addPet(options, state = game) {
    return addToLevel(livePet(options), state);
}
