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
void test('tty keeps an empty capacity separator after shortening until capacity changes', async () => {
    freshObjectRoom({ moves: 10000, flags: { time: true }, hero: { blindTurns: 5, uhs: 1 } });
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 50, rows: 24 }));
    await bot();
    assert.match(status(), /T:10000  Bl/);
    game.moves = 9;
    await bot();
    assert.match(status(), /T:9  Blnd/, 'an unchanged capacity keeps its blank during a full status refresh');
    game.moves = 8;
    timebot();
    assert.match(status(), /T:8  Blnd/, 'a time-only refresh also keeps the capacity blank');
    setHeroGoldAmount(game, 1234567);
    await bot();
    setHeroGoldAmount(game, 0);
    await bot();
    assert.match(status(), /T:8 Blind/, 'becoming unencumbered resets the empty capacity field');
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
void test('a shortened tutorial level restores the Dlvl prefix on later status refits', async () => {
    freshObjectRoom({ moves: 100000000, flags: { time: true }, hero: { uhs: 1 } });
    game._tutorialActive = true;
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 52, rows: 24 }));
    await bot();
    assert.match(status(), /^Dl:8 /, 'the crowded tutorial row abbreviates the level');
    game.moves = 9;
    timebot();
    assert.match(status(), /^Dlvl:8 /, 'refitting restores the native dungeon prefix');
    await bot();
    assert.match(status(), /^Dlvl:8 /, 'an unchanged level field keeps the restored prefix');
    requirePlayingGame(game);
    game.u.uz.dlevel = 9;
    await bot();
    assert.match(status(), /^Tutorial:9 /, 'a changed level supplies its full tutorial label');
});
//# sourceMappingURL=status_tty_fit.test.js.map