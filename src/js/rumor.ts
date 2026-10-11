// C rumors.c:outrumor(BY_COOKIE). Callers own literacy and the cookie itself.
import { FAINTED } from './const.js';
import { plineWithContinuation as pline } from './display.js';
import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { getRumor } from './mklev.js';
import { heroIsBlind } from './senses.js';

export async function readCookieFortune(
    cookie: GameObject, { state = game }: { state?: GameState } = {},
): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.uhs === FAINTED) return;
    if (heroIsBlind(state)) {
        await pline('This cookie has a scrap of paper inside.');
        await pline('What a pity that you cannot read it!');
        return;
    }
    const rumor = getRumor(false, cookie.blessed ? 1 : cookie.cursed ? -1 : 0)
        || 'NetHack rumors file closed for renovation.';
    await pline('This cookie has a scrap of paper inside.');
    await pline('It reads:');
    await pline(rumor);
}
