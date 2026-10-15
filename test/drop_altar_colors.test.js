import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { ALTAR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a hallucinated altar flash has a color but does not reveal beatitude', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = ALTAR;
    const dagger = await addInventoryObject(DAGGER, {
        invlet: 'a', blessed: true, bknown: false,
    });
    game.u.hallucinationTurns = 20;
    pushKeys('a');
    await rhack('d'.charCodeAt(0));
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.bknown, false);
    assert.match(game._pending_message, /There is an? .+ flash as .+ hits the altar\./);
    assert.doesNotMatch(game._pending_message, /multicolored/);
    assert.equal(game.u.uconduct?.gnostic, 1);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=drop_altar_colors.test.js.map