import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { TT_WEB } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { setHeroTrap } from '../js/hero_traps.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

function statusLine(): string {
    const display = requireGameDisplay();
    return (display.grid[23] ?? []).map(cell => cell.ch).join('');
}

void test('a levitating hero shows Lev as soon as it disentangles itself from a web', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.levitationTurns = 50;
    setHeroTrap(1, TT_WEB);
    await bot();
    await flush_screen(1);
    assert.doesNotMatch(statusLine(), /\bLev\b/, 'the web holds the hero down');

    await rhack('l'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(game._pending_message, 'You disentangle yourself.');
    assert.match(statusLine(), /\bLev\b/);
});
