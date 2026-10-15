import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CLOUD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a storm in the hero\'s cloud causes temporary deafness and hiding', async () => {
    const input = freshTurnRoom({ hero: { uhp: 1000, uhpmax: 1000 }, seed: 19n });
    requirePlayingGame(game);
    game.level.flags.stormy = true;
    game.level.requireAt(game.u.ux, game.u.uy).typ = CLOUD;
    grantIntrinsicProperty('shockResistance', 'outside');
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    installPagerInput(input, { expected: /./, limit: 30 });
    input.feed('s'.repeat(100));
    for (let turn = 0; turn < 32 && !(game.u.deafTurns ?? 0); turn++)
        await moveloop_core();
    assert.ok((game.u.deafTurns ?? 0) >= 25, 'No deafening thunderstorm in 32 world turns');
    assert.match([...messages, game._pending_message || game._retained_message].join('\n'), /Kaboom!!!  Boom!!  Boom!!/);
    assert.equal(game._helplessReason, 'hiding from thunderstorm');
});
//# sourceMappingURL=timeout_storms.test.js.map