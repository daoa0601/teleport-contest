// Food contact after thitmonst's weapon and successful splash branches.
// C dothrow.c:thitmonst(), tmiss(FALSE); mondata.h:befriend_with_obj().
import { objectMaterial } from './object_material.js';
import { STRAT_WAITMASK } from './const.js';
import { MONSTER_FLAGS2, MONSTER_NAME, MONSTER_SYMBOL } from './monster_data.js';
import { reportHeroThrownMiss } from './hero_physical_messages.js';
import { tameMonster } from './monster_taming.js';
import { BANANA, CORPSE } from './object_data.js';
import { ACCFOOD, dogFood } from './pet_food.js';
import { rn2 } from './rng.js';
const PM_MONKEY = MONSTER_NAME.indexOf('monkey');
const PM_APE = MONSTER_NAME.indexOf('ape');
const PM_LICHEN = MONSTER_NAME.indexOf('lichen');
const M2_DOMESTIC = 0x00400000;
const S_UNICORN = 21;
const FOOD_CLASS = 7;
const VEGGY = 3;
// The caller has already made the ordinary contact rolls. A null result lets
// it continue to the next thitmonst branch. Handled food can be consumed or
// spat back onto the floor, so its caller must not place the object again.
export async function offerThrownFood(monster, object, state) {
    if (!befriendsWithFood(monster, object)
        && !(monster.mtame && dogFood(monster, object, rn2, [], state) <= ACCFOOD))
        return null;
    const handled = await tameMonster(monster, object, { state, announce: true });
    if (state.program_state.gameover)
        return { heroDied: true };
    if (!handled) {
        await reportHeroThrownMiss(monster, object, { state });
        monster.msleeping = 0;
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
    return { heroDied: false, handled };
}
function befriendsWithFood(monster, object) {
    if (monster.mnum === PM_MONKEY || monster.mnum === PM_APE)
        return object.otyp === BANANA;
    if (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_DOMESTIC)
        || object.oclass !== FOOD_CLASS)
        return false;
    return MONSTER_SYMBOL[monster.mnum] !== S_UNICORN
        || objectMaterial(object.otyp) === VEGGY
        || object.otyp === CORPSE && object.corpsenm === PM_LICHEN;
}
//# sourceMappingURL=thrown_food.js.map