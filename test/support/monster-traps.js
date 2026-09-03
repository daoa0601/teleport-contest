import { addObjectToMonsterInventory } from '../../js/monster_inventory.js';
import { addTrap } from './level-state.js';
import { createMonsterAt, equipMonsterObject } from './monsters.js';
import { freshObjectRoom } from './object-room.js';

export async function freshMonsterTrapRoom(trapType, {
    x = 11,
    y = 10,
    gameplaySeed,
    room = {},
    monster = {},
    trap = {},
} = {}) {
    const level = freshObjectRoom({ ...room, gameplaySeed });
    const {
        mnum,
        species = 'giant',
        hitPoints,
        maxHitPoints = hitPoints,
        level: monsterLevel,
        inventory = [],
        minvent = inventory,
        ...monsterState
    } = monster;
    const actor = await createMonsterAt(mnum ?? species, x, y);
    if (hitPoints !== undefined) actor.mhp = hitPoints;
    if (maxHitPoints !== undefined) actor.mhpmax = maxHitPoints;
    if (monsterLevel !== undefined) actor.m_lev = monsterLevel;
    Object.assign(actor, monsterState);
    for (const object of minvent) {
        if (object.owornmask)
            equipMonsterObject(actor, object, object.owornmask, level);
        else
            addObjectToMonsterInventory(actor, object, level);
    }
    const placedTrap = addTrap(level, trapType, x, y, trap);
    return { level, monster: actor, trap: placedTrap };
}
