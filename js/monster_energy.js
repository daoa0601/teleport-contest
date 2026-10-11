// C mhitm.c:xdrainenergym(). The attack owner decides whether draining hits.
import { game } from './gstate.js';
import { plineWithContinuation } from './display.js';
import { AT_BREA, AT_MAGC } from './monster_attack_types.js';
import { MONSTER_ATTACKS } from './monster_data.js';
import { monsterName } from './monster_name.js';
import { d } from './rng.js';
export async function drainMonsterEnergy(monster, { state = game, publish = plineWithContinuation, rollDice = d, giveMessage = true, } = {}) {
    if ((monster.mspec_used ?? 0) >= 20
        || !(MONSTER_ATTACKS[monster.mnum] ?? []).some(([method]) => method === AT_MAGC || method === AT_BREA))
        return;
    monster.mspec_used = (monster.mspec_used ?? 0) + rollDice(2, 2);
    if (giveMessage)
        await publish(`${monsterName(monster, { state, capitalized: true })} seems lethargic.`);
}
//# sourceMappingURL=monster_energy.js.map