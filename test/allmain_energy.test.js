import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { A_INT, A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DUNCE_CAP } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
void test('energy recovery uses the Intelligence and Wisdom limited by a dunce cap', async () => {
    for (let seed = 1n; seed <= 8n; seed++) {
        const input = freshTurnRoom({ role: 'wizard', heroLevel: 30, moves: 3, energy: 100, seed });
        requirePlayingGame(game);
        game.u.uen = 0;
        game.u.acurr.a[A_INT] = 25;
        game.u.acurr.a[A_WIS] = 25;
        await wearHeroArmor(await addInventoryObject(DUNCE_CAP, { initialize: false }));
        installPagerInput(input, { expected: /cap|dunce|stupid/, limit: 2 });
        input.feed('m.');
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /cap|dunce|stupid|^$/);
        assert.equal(game.moves, 4);
        assert.equal(game.u.uen, 1, 'Effective Intelligence and Wisdom of 6 allow one energy point');
    }
});
//# sourceMappingURL=allmain_energy.test.js.map