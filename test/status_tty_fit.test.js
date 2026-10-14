import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, timebot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
function status() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}
void test('tty shortens all condition names together before losing a condition', async () => {
    freshObjectRoom({ flags: { time: true }, hero: {
            blindTurns: 5, confusionTurns: 5, deafTurns: 5,
            hallucinationTurns: 5, stunnedTurns: 5,
        } });
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 70, rows: 24 }));
    await bot();
    assert.match(status(), /Bl Cf Df Hl St/);
    assert.equal(status().at(-1), ' ');
});
void test('tty shortens encumbrance after the conditions reach their shortest form', async () => {
    freshObjectRoom({ hero: { blindTurns: 5, confusionTurns: 5, uhs: 1 } });
    setHeroGoldAmount(game, 1234567);
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 60, rows: 24 }));
    await bot();
    assert.match(status(), /Overload Bl Cf/);
});
void test('a time-only update refits the row while retaining earlier health', async () => {
    freshObjectRoom({ moves: 9, flags: { time: true }, hero: { blindTurns: 5, uhs: 1 } });
    requirePlayingGame(game);
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 51, rows: 24 }));
    await bot();
    assert.match(status(), /T:9 Blind/);
    game.moves = 10000;
    game.u.uhp = 2;
    timebot();
    assert.match(status(), /HP:40\(40\)/);
    assert.match(status(), /T:10000 Bl/);
    assert.equal(status().at(-1), ' ');
});
//# sourceMappingURL=status_tty_fit.test.js.map