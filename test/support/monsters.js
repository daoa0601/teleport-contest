import { MM_NOMSG, W_SADDLE, W_WEP } from '../../js/const.js';
import { game } from '../../js/gstate.js';
import { makemonAt } from '../../js/mklev.js';
import { nameToMonster } from '../../js/mondata.js';
import { addObjectToMonsterInventory } from '../../js/monster_inventory.js';
import { initializePet } from '../../js/dog.js';
import { SADDLE } from '../../js/object_data.js';
import { putSaddleOnMonster } from '../../js/steed.js';
import { knownObject } from './game-objects.js';
import { applyMonsterEquipmentProperties } from '../../js/monster_equipment.js';
export function requireMonsterVital(species, state = game) {
    const vital = state.mvitals?.[species];
    if (!vital)
        throw new Error(`Monster species ${species} has no initialized vitals`);
    return vital;
}
export async function createMonsterAt(species, x, y, flags = 0) {
    const mnum = typeof species === 'number' ? species : nameToMonster(species);
    if (mnum < 0)
        throw new Error(`Unknown monster: ${species}`);
    // Setup births retain native placement effects without arrival prose.
    const monster = await makemonAt(mnum, x, y, flags | MM_NOMSG);
    if (!monster)
        throw new Error(`Could not create ${species} at ${x},${y}`);
    return monster;
}
export async function createSaddledSteed(species = 'pony', { x = game.u.ux + 1, y = game.u.uy, saddle = {}, } = {}) {
    const steed = await createMonsterAt(species, x, y);
    initializePet(steed, { state: game });
    await putSaddleOnMonster(await knownObject(SADDLE, saddle), steed);
    return steed;
}
export async function equipMonsterObject(monster, object, wornMask, state = game) {
    const carried = await addObjectToMonsterInventory(monster, object, state);
    if (!carried)
        throw new Error('Monster equipment was not retained in inventory');
    carried.owornmask = wornMask;
    carried.worn = wornMask !== 0;
    // C mon_wield_item() keeps W_WEP out of find_mac()'s armor mask.
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | (wornMask & ~W_WEP);
    if (wornMask & W_WEP) {
        carried.wielded = true;
        monster.mw = carried;
    }
    if (wornMask & W_SADDLE) {
        monster.saddle = carried;
        monster.saddled = true;
    }
    if (wornMask)
        applyMonsterEquipmentProperties(monster, carried, true);
    return carried;
}
//# sourceMappingURL=monsters.js.map