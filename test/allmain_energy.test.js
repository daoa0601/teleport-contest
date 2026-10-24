import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_INT, A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DUNCE_CAP, OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
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
for (const source of ['amulet', 'intrinsic']) {
    void test(`energy recovery ${source === 'amulet' ? 'gains' : 'does not gain'} the magical breathing bonus from an ${source}`, async () => {
        let recovered = 0;
        for (let seed = 1n; seed <= 8n; seed++) {
            const input = freshTurnRoom({ role: 'wizard', heroLevel: 30, moves: 3, energy: 100, seed });
            requirePlayingGame(game);
            game.u.uen = 0;
            game.u.acurr.a[A_INT] = 6;
            game.u.acurr.a[A_WIS] = 6;
            if (source === 'amulet') {
                await wearHeroAccessory(await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { initialize: false }), 'uamul');
            }
            else
                grantIntrinsicProperty('magicalBreathing', 'outside');
            installPagerInput(input, { expected: /amulet|^$/, limit: 2 });
            input.feed('m.');
            await moveloop_core();
            await finishAtCommandInput(input, moveloop_core, /amulet|^$/);
            assert.ok(game.u.uen >= 1 && game.u.uen <= (source === 'amulet' ? 3 : 1));
            recovered += game.u.uen;
        }
        if (source === 'amulet')
            assert.ok(recovered > 8, `The amulet restored ${recovered} energy across eight turns`);
        else
            assert.equal(recovered, 8);
    });
}
//# sourceMappingURL=allmain_energy.test.js.map