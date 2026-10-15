// C timeout.c:do_storms(), after ambient sounds and before hunger.
import { castMonsterSpellRay } from './breath_ray.js';
import { CLOUD, COLNO, ROWNO } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { AD_ELEC, AT_MAGC } from './monster_attack_types.js';
import { stopHeroOccupation } from './occupation.js';
import { propertyTimeout, setPropertyTimeout } from './properties.js';
import { rn1, rn2, rnd } from './rng.js';
import { stopRun } from './runmode.js';
import { formatHeardMessage } from './hero_speech.js';
const DIRECTIONS = [
    [-1, -1, 'y'], [0, -1, 'k'], [1, -1, 'u'], [-1, 0, 'h'],
    [1, 0, 'l'], [-1, 1, 'b'], [0, 1, 'j'], [1, 1, 'n'],
];
export async function doStorms(state = game) {
    requirePlayingGame(state);
    const level = state.level;
    if (!level.flags.stormy || rn2(8) !== 0)
        return;
    for (let strike = rnd(64); strike <= 64; strike *= 2) {
        let count = 0;
        let x, y;
        do {
            x = rnd(COLNO - 1);
            y = rn2(ROWNO);
        } while (++count < 100 && level.requireAt(x, y).typ !== CLOUD);
        if (count >= 100)
            continue;
        const dx = rn2(3) - 1, dy = rn2(3) - 1;
        if (dx === 0 && dy === 0)
            continue;
        const direction = DIRECTIONS.find(([xdir, ydir]) => xdir === dx && ydir === dy)?.[2];
        if (!direction)
            throw new Error(`Storm chose invalid direction ${dx},${dy}`);
        await castMonsterSpellRay(direction, x, y, [AT_MAGC, AD_ELEC, 8, 6], { state });
        if (state.program_state.gameover)
            return;
    }
    if (level.requireAt(state.u.ux, state.u.uy).typ !== CLOUD) {
        const message = formatHeardMessage('a rumbling noise.', state);
        if (message)
            await plineWithContinuation(message);
        return;
    }
    await plineWithContinuation('Kaboom!!!  Boom!!  Boom!!');
    setPropertyTimeout('deaf', propertyTimeout('deaf', state) + rn1(20, 30), state);
    state.context.botl = true;
    if (state.u.invulnerable)
        return;
    await stopHeroOccupation(state);
    const dressing = state._delayedAction;
    const remainingTurns = Math.max(state._helplessTurns ?? 0, dressing && dressing.kind !== 'steal' ? dressing.remainingGlobalTurns : 0);
    if (remainingTurns <= 3) {
        // nomul(-3) clears sleep when it accepts the thunder's delay.
        state.u.usleep = 0;
        state.multi = -3;
        state._helplessTurns = 3;
        stopRun(state);
    }
    if (dressing && dressing.kind !== 'steal') {
        // Dressing's afternmv callback shares native multi with hiding.
        // Thunder also replaces its completion text, even for a longer delay.
        const duration = Math.max(remainingTurns, 3);
        dressing.remainingGlobalTurns = duration;
        dressing.ready = false;
        dressing.finishMessage = '';
        state._helplessTurns = duration;
        state.multi = -duration;
    }
    state._helplessReason = 'hiding from thunderstorm';
    delete state._helplessDoneMessage;
}
//# sourceMappingURL=storms.js.map