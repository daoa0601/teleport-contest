import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { angerWatchGuards, isWatch } from './monster_anger.js';
import { ghodHitsu } from './priest.js';
import { rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
// Capture before damage or wakeup changes peacefulness, species, or residency.
export function shouldAngerGuardsAfterHeroHit(monster) {
    return !!monster.mpeaceful
        && !!(monster.ispriest || monster.isshk || isWatch(monster));
}
export async function finishHeroHitAftermath(monster, { angerGuards, state = game, publish = plineWithContinuation, random = rn2, }) {
    requireLiveGame(state);
    if (state.program_state.gameover)
        return { heroDied: true };
    // This is independent of wakeup's peaceful-priest response and still
    // applies when the hit has killed the priest or changed its attitude.
    if (monster.ispriest && random(2) === 0) {
        const retaliation = await ghodHitsu(monster, { state, publish });
        if (retaliation.heroDied)
            return retaliation;
    }
    if (angerGuards)
        await angerWatchGuards(heroIsDeaf(state), { state, publish });
    return { heroDied: false };
}
//# sourceMappingURL=hero_hit_aftermath.js.map