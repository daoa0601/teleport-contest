import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { THRONE, DUST } from '../js/const.js';
import { deferredDecor } from '../js/dungeon_feature.js';
import { makeEngravingAt } from '../js/engrave.js';
import { resetInputState } from '../js/input.js';
import { autopickupAtHero } from '../js/pickup.js';
import { setPropertyTimeout } from '../js/properties.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom, freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('mention_decor describes an arrival feature when autopickup finds nothing', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: true, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    await autopickupAtHero();
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
});
void test('furniture decor repeats because same-terrain suppression skips furniture', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: true, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    await autopickupAtHero();
    await autopickupAtHero();
    // The topline merges short consecutive messages, so a repeated feature
    // line shows up twice; a suppressed second call would leave it once.
    assert.equal(game._pending_message, 'There is an opulent throne here.  There is an opulent throne here.');
});
void test('a hero who cannot reach the floor still hears the feature underneath', async () => {
    const level = freshPlayableRoom({ flags: { verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    await floorObject(GOLD_PIECE, 10, 10, { quan: 5 });
    setPropertyTimeout('levitation', 10);
    await autopickupAtHero();
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
    assert.equal(game.inventory.length, 0);
});
void test('a levitating hero over unreachable loot still reads the floor engraving', async () => {
    freshPlayableRoom({ flags: { verbose: true } });
    makeEngravingAt(10, 10, 'a faded warning', null, 0, DUST);
    await floorObject(GOLD_PIECE, 10, 10, { quan: 37 });
    setPropertyTimeout('levitation', 10);
    await autopickupAtHero();
    assert.match(game._lastPlineMessage, /You read: "a faded warning"\.$/);
    assert.equal(game.inventory.length, 0);
});
void test('an imminent fumble holds the arrival feature back until after the trip', async () => {
    const input = freshTurnRoom({ flags: { mention_decor: true, verbose: true } });
    requirePlayingGame(game);
    requireGameLevel().requireAt(11, 10).typ = THRONE;
    game.u.fumblingTurns = 1;
    installPagerInput(input, { expected: /opulent throne|flounder|noise/, limit: 4 });
    input.feed('l');
    // The first iteration moves and defers the description; the movement
    // ration settles on the next iteration, where the fumble timeout runs.
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.ux, 11);
    // The throne description was deferred behind the fumble feedback and
    // catches up once the turn's fumble timeout resolves.
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
    assert.equal(game.iflags.deferDecor, false);
});
void test('a deferred decor message is described once the fumble resolves', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: true, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    game.iflags.deferDecor = true;
    await deferredDecor(false);
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
    assert.equal(game.iflags.deferDecor, false);
});
void test('turning mention_decor off drops a deferred decor message without describing it', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: false, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    game.iflags.deferDecor = true;
    await deferredDecor(false);
    assert.equal(game._lastPlineMessage, '');
    assert.equal(game.iflags.deferDecor, false);
});
//# sourceMappingURL=pickup_arrival_decor.test.js.map