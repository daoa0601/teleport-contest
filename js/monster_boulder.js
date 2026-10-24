// C monmove.c:m_can_break_boulder() and m_break_boulder().
import { plineWithContinuation } from './display.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import { monsterIsRider } from './monster_data.js';
import { questMonsterSound } from './role_monsters.js';
import { monsterName } from './monster_name.js';
import { BOULDER } from './object_data.js';
import { fractureRock } from './rock_breakage.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { billDummyObject } from './shk.js';
import { cansee } from './vision.js';
const MS_LEADER = 36;
export function monsterCanBreakBoulder(monster) {
    return !!(monsterIsRider(monster)
        || !monster.mspec_used && (monster.isshk || monster.ispriest
            || questMonsterSound(monster.mnum) === MS_LEADER));
}
export async function breakMonsterBoulder(monster, x, y, state = game, { random = rn2, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!monsterCanBreakBoulder(monster))
        return;
    const boulder = requireGameLevel(state).objects[x]?.[y]
        ?.find(object => object.otyp === BOULDER);
    if (!boulder)
        return;
    if (!monsterIsRider(monster)) {
        const distance = (monster.mx - state.u.ux) ** 2
            + (monster.my - state.u.uy) ** 2;
        if (!heroIsDeaf(state) && distance < 16) {
            await publish(`${monsterName(monster, { capitalized: true, state })} mutters ${monster.ispriest ? 'a prayer' : 'an incantation'}.`);
        }
        monster.mspec_used = (monster.mspec_used ?? 0) + 10 + random(20);
    }
    if (cansee(x, y))
        await publish('The boulder falls apart.');
    if (boulder.unpaid)
        await billDummyObject(boulder, state);
    await fractureRock(boulder, x, y, { state, random, publish });
}
//# sourceMappingURL=monster_boulder.js.map