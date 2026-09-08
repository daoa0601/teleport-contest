import { W_SADDLE, W_WEP } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { makemonAt } from '../../js/mklev.js';
import { nameToMonster } from '../../js/mondata.js';
import { addObjectToMonsterInventory } from '../../js/monster_inventory.js';
import { tameMonster } from '../../js/dog.js';
import { SADDLE } from '../../js/object_data.js';
import { putSaddleOnMonster } from '../../js/steed.js';
import { knownObject } from './game-objects.js';
import { applyMonsterEquipmentProperties } from '../../js/monster_equipment.js';

export async function createMonsterAt(species, x, y, flags = 0) {
    const mnum = typeof species === 'number' ? species : nameToMonster(species);
    if (mnum < 0) throw new Error(`Unknown monster: ${species}`);
    const monster = await makemonAt(mnum, x, y, flags);
    if (!monster)
        throw new Error(`Could not create ${species} at ${x},${y}`);
    return monster;
}

export async function createSaddledSteed(species = 'pony', {
    x = game.u.ux + 1,
    y = game.u.uy,
    saddle = {},
} = {}) {
    const steed = await createMonsterAt(species, x, y);
    tameMonster(steed, game);
    putSaddleOnMonster(knownObject(SADDLE, saddle), steed);
    return steed;
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
    if (wornMask) applyMonsterEquipmentProperties(monster, carried, true);
    return carried;
}
