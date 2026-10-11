import { installPagerInput, finishAtCommandInput } from './support/pager-input.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { game } from '../js/gstate.js';
import { discardMonsterInventory } from '../js/monster_drop.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

void test('an angry confused keeper can attack twice before its turn ends', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    await discardMonsterInventory(shopkeeper, false);
    shopkeeper.eshk.shknam = '+Mira';
    shopkeeper.mpeaceful = false;
    shopkeeper.mconf = 1;
    shopkeeper.movement = 12;
    game.u.uhp = game.u.uhpmax = 500;
    game.u.uac = 50;
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, { expected: /Mira hits/, limit: 4 });
    input.feed('m.');

    await moveloop_core();
    await finishAtCommandInput(input, () => moveloop_core(), /Mira hits/);

    assert.ok(shopkeeper.mconf, 'the keeper remains confused during this turn');
    assert.ok(messages.some(text => (text.match(/Mira hits(?: again)?[.!]/g) || []).length === 4),
        messages.join('\n'));
    assert.ok(game.u.uhp < 500);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [11, 10]);
});

for (const confused of [false, true]) {
    void test(`life saving preserves the keeper's remaining ${confused ? 'two attack rounds' : 'attack slot'}`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop();
        await discardMonsterInventory(shopkeeper, false);
        shopkeeper.eshk.shknam = '+Mira';
        shopkeeper.mpeaceful = false;
        shopkeeper.mconf = confused ? 1 : 0;
        shopkeeper.movement = 12;
        game.u.uhp = 1;
        game.u.uhpmax = 500;
        game.u.uac = 50;
        const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
        await wearHeroAccessory(amulet, 'uamul');
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message || ''); };
        installPagerInput(input, { expected: /Mira hits|die|But wait|medallion|feel much better/i, limit: 10 });
        input.feed('m.');

        await moveloop_core();
        await finishAtCommandInput(input, () => moveloop_core(), /Mira hits|medallion|feel much better/i);

        assert.ok(!game.program_state.gameover);
        assert.equal(game.u.umortality, 1);
        assert.equal(amulet.where, 'gone');
        assert.ok(game.u.uhp > 0);
        const hits = (messages.join('\n').match(/Mira hits(?: again)?[.!]/g) || []).length;
        assert.equal(hits, confused ? 4 : 2, messages.join('\n'));
    });
}
