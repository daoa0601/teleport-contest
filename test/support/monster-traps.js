import { addObjectToMonsterInventory } from '../../js/monster_inventory.js';
import { addTrap } from './level-state.js';
import { createMonsterAt, equipMonsterObject } from './monsters.js';
import { freshObjectRoom } from './object-room.js';
export async function freshMonsterTrapRoom(trapType, { x = 11, y = 10, gameplaySeed, room = {}, monster = {}, trap = {}, } = {}) {
    const level = freshObjectRoom({ ...room, ...(gameplaySeed === undefined ? {} : { gameplaySeed }) });
    const { mnum, species = 'giant', hitPoints, maxHitPoints = hitPoints, level: monsterLevel, inventory = [], minvent = inventory, mtrapped, mtrapseen, mpeaceful, minvis, misc_worn_check, msleeping, mcanmove, mfrozen, mhp, mhpmax, m_lev, mtrack, cham, } = monster;
    const actor = await createMonsterAt(mnum ?? species, x, y);
    if (hitPoints !== undefined)
        actor.mhp = hitPoints;
    if (maxHitPoints !== undefined)
        actor.mhpmax = maxHitPoints;
    if (monsterLevel !== undefined)
        actor.m_lev = monsterLevel;
    if (mtrapped !== undefined)
        actor.mtrapped = mtrapped;
    if (mtrapseen !== undefined)
        actor.mtrapseen = mtrapseen;
    if (mpeaceful !== undefined)
        actor.mpeaceful = mpeaceful;
    if (minvis !== undefined)
        actor.minvis = minvis;
    if (misc_worn_check !== undefined)
        actor.misc_worn_check = misc_worn_check;
    if (msleeping !== undefined)
        actor.msleeping = msleeping;
    if (mcanmove !== undefined)
        actor.mcanmove = mcanmove;
    if (mfrozen !== undefined)
        actor.mfrozen = mfrozen;
    if (mhp !== undefined)
        actor.mhp = mhp;
    if (mhpmax !== undefined)
        actor.mhpmax = mhpmax;
    if (m_lev !== undefined)
        actor.m_lev = m_lev;
    if (mtrack !== undefined)
        actor.mtrack = mtrack;
    if (cham !== undefined)
        actor.cham = cham;
    for (const object of minvent) {
        if (object.owornmask)
            await equipMonsterObject(actor, object, object.owornmask);
        else
            await addObjectToMonsterInventory(actor, object);
    }
    const placedTrap = addTrap(level, trapType, x, y, trap);
    return { level, monster: actor, trap: placedTrap };
}
//# sourceMappingURL=monster-traps.js.map