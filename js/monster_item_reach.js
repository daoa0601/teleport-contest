import { MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_NAME } from './monster_data.js';
import { BOULDER } from './object_data.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
const M1_SWIM = 0x2, M2_ROCKTHROW = 0x08000000;
const PM_FIRE_ELEMENTAL = MONSTER_NAME.indexOf('fire elemental');
const PM_SALAMANDER = MONSTER_NAME.indexOf('salamander');
export function monsterCouldReachItem(monster, x, y, state) {
    if (isPoolAt(x, y, state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SWIM))
        return false;
    if (isLavaAt(x, y, state)
        && monster.mnum !== PM_FIRE_ELEMENTAL && monster.mnum !== PM_SALAMANDER)
        return false;
    return !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW)
        || !(state.level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER);
}
//# sourceMappingURL=monster_item_reach.js.map