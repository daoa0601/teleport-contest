// C read.c:seffect_teleportation(). The read transaction owns useup().
import { askTeleportDestination } from './cmd.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { levelTeleport } from './level_teleport.js';
import { learnScroll } from './scroll_discovery.js';
import { teleportHero } from './teleport.js';
export async function teleportScrollEffect(source, { state = game, gotoLevel, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    let known = false;
    if (source.cursed || state.u.confused || (state.u.confusionTurns ?? 0) > 0) {
        await levelTeleport({ state, ...(gotoLevel ? { gotoLevel } : {}) });
        known = true;
    }
    else {
        await teleportHero({
            source, chooseDestination: askTeleportDestination,
            discover: async () => {
                await learnScroll(source, { state });
            },
        });
    }
    return { known, consumed: false, heroDied: !!state.program_state.gameover };
}
//# sourceMappingURL=scroll_teleport.js.map