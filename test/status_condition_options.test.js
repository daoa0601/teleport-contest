import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, TT_LAVA } from '../js/const.js';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenRow } from './support/screen.js';
function status() {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}
void test('a sea monster drowning hold precedes the other dangerous conditions', async () => {
    freshObjectRoom({ hero: { strangledTurns: 5 } });
    requirePlayingGame(game);
    game.u.ustuck = await createMonsterAt('giant eel', 11, 10, NO_MINVENT);
    await bot();
    assert.match(status(), /Grab Strngl/);
});
void test('lava entrapment appears ahead of blindness', async () => {
    freshObjectRoom({ hero: { utrap: 4, utraptype: TT_LAVA, blindTurns: 5 } });
    await bot();
    assert.match(status(), /InLava Blind/);
});
void test('permanent confusion is displayed without a timeout', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('confusion', 'outside');
    await bot();
    assert.match(status(), /\bConf\b/);
});
void test('condition options can enable bare hands and slippery fingers and disable blindness', async () => {
    freshObjectRoom({ hero: { blindTurns: 5, glibTurns: 4 } });
    applyNethackrc('OPTIONS=cond_barehanded,cond_slip,!cond_blind');
    await bot();
    assert.match(status(), /Bare Slip/);
    assert.doesNotMatch(status(), /\bBlind\b/);
});
void test('an opt-in ordinary hold stays hidden unless its condition is enabled', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.ustuck = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    await bot();
    assert.doesNotMatch(status(), /\bHeld\b/);
    applyNethackrc('OPTIONS=cond_held');
    await bot();
    assert.match(status(), /\bHeld\b/);
});
//# sourceMappingURL=status_condition_options.test.js.map