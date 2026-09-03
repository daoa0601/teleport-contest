import { W_SADDLE, W_WEP } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { makemonAt } from '../../js/mklev.js';
import { nameToMonster } from '../../js/mondata.js';
import { MONSTER_NAME } from '../../js/monster_data.js';
import { addObjectToMonsterInventory } from '../../js/monster_inventory.js';

export function addMonster({
    mnum,
    species,
    x,
    y,
    hitPoints = 20,
    maxHitPoints = hitPoints,
    level = 1,
    inventory: listedInventory,
    minvent,
    ...overrides
}, state = game) {
    const inventory = listedInventory ?? minvent ?? [];
    const monster = {
        mnum: mnum ?? MONSTER_NAME.indexOf(species),
        mx: x,
        my: y,
        m_lev: level,
        mhp: hitPoints,
        mhpmax: maxHitPoints,
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
    if (monster.m_id === undefined)
        monster.m_id = 1000 + state.level.monsters.length;
    for (const object of inventory) {
        object.where = 'minvent';
        object.carrierMid = monster.m_id;
    }
    monster.hasInventory = inventory.length > 0;
    state.level.monsters.push(monster);
    return monster;
}

export async function createMonsterAt(species, x, y, flags = 0) {
    const mnum = typeof species === 'number' ? species : nameToMonster(species);
    if (mnum < 0) throw new Error(`Unknown monster: ${species}`);
    const monster = await makemonAt(mnum, x, y, flags);
    if (!monster)
        throw new Error(`Could not create ${species} at ${x},${y}`);
    return monster;
}

export function equipMonsterObject(monster, object, wornMask, state = game) {
    const carried = addObjectToMonsterInventory(monster, object, state);
    carried.owornmask = wornMask;
    carried.worn = wornMask !== 0;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | wornMask;
    if (wornMask & W_WEP) {
        carried.wielded = true;
        monster.mw = carried;
    }
    if (wornMask & W_SADDLE) {
        monster.saddle = carried;
        monster.saddled = true;
    }
    return carried;
}
