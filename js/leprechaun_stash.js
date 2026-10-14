// C monmove.c:leppie_stash(), after a successful fleeing teleport.
import { buryObject } from './buried_object.js';
import { ROOM, SHOPBASE } from './const.js';
import { game, requireGameLevel } from './gstate.js';
import { MONSTER_NAME } from './monster_data.js';
import { dropMonsterObject } from './monster_drop.js';
import { monsterHasLineOfSightToHero } from './monster_perception.js';
import { GOLD_PIECE } from './object_data.js';
import { rn2 } from './rng.js';
import { roomsAt } from './room.js';
export async function stashLeprechaunGold(monster, state = game, random = rn2) {
    const level = requireGameLevel(state);
    if (monster.mnum !== MONSTER_NAME.indexOf('leprechaun') || monster.dead || monster.mhp <= 0
        || monsterHasLineOfSightToHero(monster, state)
        || roomsAt(level, monster.mx, monster.my, SHOPBASE).length
        || level.at(monster.mx, monster.my)?.typ !== ROOM
        || level.traps.some(trap => trap.tx === monster.mx && trap.ty === monster.my)
        || !random(4))
        return;
    const gold = monster.minvent?.find(object => object.otyp === GOLD_PIECE);
    if (!gold)
        return;
    await dropMonsterObject(monster, gold, state, { random });
    const dropped = level.objects[monster.mx]?.[monster.my]?.find(object => object.otyp === GOLD_PIECE);
    if (dropped)
        await buryObject(dropped, state);
}
//# sourceMappingURL=leprechaun_stash.js.map