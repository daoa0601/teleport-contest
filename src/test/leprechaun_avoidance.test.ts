import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { beginMonsterMove, takeMonsterTurn } from '../js/monmove.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a leprechaun carrying gold retreats from a penniless adjacent hero instead of attacking', async () => {
    freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10, heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const leprechaun = await createMonsterAt('leprechaun', 13, 10, MM_ANGRY | NO_MINVENT);
    leprechaun.msleeping = 0;
    await addObjectToMonsterInventory(leprechaun, await knownObject(GOLD_PIECE, { quantity: 100 }), game);

    await takeMonsterTurn(leprechaun, game, limit => limit - 1);

    assert.equal(leprechaun.mx, 12);
    assert.equal(leprechaun.my, 10);
    assert.equal(game.u.uhp, 40);
});

for (const heroGold of [100, 200]) {
    void test(`a leprechaun carrying 100 gold pieces still approaches a hero carrying ${heroGold}`, async () => {
        freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 12, heroX: 13, heroY: 10 });
        requirePlayingGame(game);
        const leprechaun = await createMonsterAt('leprechaun', 10, 10, MM_ANGRY | NO_MINVENT);
        await addObjectToMonsterInventory(leprechaun, await knownObject(GOLD_PIECE, { quantity: 100 }), game);
        await addInventoryObject(GOLD_PIECE, { quantity: heroGold });
        leprechaun.mux = game.u.ux;
        leprechaun.muy = game.u.uy;

        await beginMonsterMove(leprechaun, game, limit => limit - 1);

        assert.equal(leprechaun.mx, 11);
    });
}
