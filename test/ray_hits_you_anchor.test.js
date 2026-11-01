import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
// C zap.c:dobuzz() anchors its "hits you!" line with
// pline_dir(xytodir(-dx, -dy), ...), so vpline()'s accessiblemsg prefix
// names the square the ray arrived from.
void test('a ray that reaches the hero carries the accessiblemsg anchor of its source cell', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.flags.accessiblemsg = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /hits you|whizzes|tingles/, limit: 8 });
    await castNativeRay(0, 2, 'h', {
        state: game,
        originX: 12,
        originY: 10,
        random: () => 0,
        rollOne: () => 1,
    });
    const said = [...game._messageHistory, game._pending_message].join(' | ');
    assert.match(said, /\(east\): .* hits you!/);
});
//# sourceMappingURL=ray_hits_you_anchor.test.js.map