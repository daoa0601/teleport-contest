import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, updateStatusLines } from '../js/display.js';
import { addExperience } from '../js/exper.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { parseNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { createDungeon } from './support/topology.js';
// botl.c:botl_score(): depth bonus is 50 per level past the first, plus
// 1000 per level past 20 and a flat 10000 past 30; carried gold counts
// only above the amount the hero started with.
// One-digit attributes keep the C row within 79 columns so the whole
// score field stays visible after "Neutral".
const ONE_DIGIT_ATTRIBUTES = {
    acurr: { a: [9, 9, 9, 9, 9, 9] }, amax: { a: [9, 9, 9, 9, 9, 9] },
};
function scoreRoom({ urexp = 0, initialGold = 0, deepest = 1, gold = 0, } = {}) {
    freshObjectRoom({ hero: ONE_DIGIT_ATTRIBUTES });
    requirePlayingGame(game);
    game.flags.showscore = true;
    game.u.urexp = urexp;
    game._initialGoldCount = initialGold;
    setHeroGoldAmount(game, gold);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', dunlev_ureached: deepest })];
}
function titleRow() {
    return requireScreenRow(22).map(cell => cell.ch).join('').trimEnd();
}
void test('showscore reports experience plus depth and net gold on the title row', async () => {
    scoreRoom({ urexp: 1234, initialGold: 200, deepest: 8 });
    await bot();
    // 1234 + 0 gold (starting purse spent) + 50*(8-1)
    assert.match(titleRow(), /Neutral S:1584$/);
});
void test('gold beyond the starting amount joins the running score', async () => {
    scoreRoom({ initialGold: 200, deepest: 1, gold: 350 });
    await bot();
    assert.match(titleRow(), /Neutral S:150$/);
});
void test('deep dungeon levels add the past-twenty depth bonus', async () => {
    scoreRoom({ deepest: 25 });
    await bot();
    // 50*(25-1) + 1000*(25-20)
    assert.match(titleRow(), /Neutral S:6200$/);
});
void test('the score field follows alignment inside the hitpoint bar row', async () => {
    scoreRoom({ urexp: 100, deepest: 2 });
    game.flags.hitpointbar = true;
    await bot();
    assert.match(titleRow(), /^\[/);
    assert.match(titleRow(), /Neutral S:150$/);
});
void test('a kill refreshes the score field through the shared status update', async () => {
    scoreRoom({ deepest: 1 });
    await bot();
    assert.match(titleRow(), /Neutral S:0$/);
    addExperience(10);
    updateStatusLines();
    assert.match(titleRow(), /Neutral S:40$/);
});
void test('the nethackrc boolean option controls the field', () => {
    const enabled = parseNethackrc('OPTIONS=showexp,showscore,time\n');
    assert.equal(enabled.flags.showscore, true);
    const disabled = parseNethackrc('OPTIONS=!showscore\n');
    assert.equal(disabled.flags.showscore, false);
});
//# sourceMappingURL=status_score_field.test.js.map