import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('vision stops updating once the game is over', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    vision_recalc(0);
    assert.equal(cansee(14, 10), true);
    // C really_done() renders the vision subsystem inoperative, so a
    // launched boulder restored for bones does not hide the hero's view.
    game.program_state.gameover = true;
    await floorObject(BOULDER, 12, 10);
    vision_recalc(0);
    assert.equal(cansee(14, 10), true);
});
void test('a boulder placed during play blocks the view behind it', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    vision_recalc(0);
    await floorObject(BOULDER, 12, 10);
    vision_recalc(0);
    assert.equal(cansee(14, 10), false);
});
//# sourceMappingURL=vision_after_game_over.test.js.map