import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a fleeing leprechaun buries its purse after teleporting out of the hero sight', async () => {
    const level = freshObjectRoom({ right: 65 });
    requirePlayingGame(game);
    for (let y = 6; y <= 14; y++) level.requireAt(40, y).typ = STONE;
    const leprechaun = await createMonsterAt('leprechaun', 11, 10, NO_MINVENT);
    leprechaun.msleeping = 0;
    leprechaun.mflee = 1;
    const gold = await knownObject(GOLD_PIECE, { quan: 300 });
    await addObjectToMonsterInventory(leprechaun, gold);
    vision_reset_new_level();
    vision_recalc(0);
    const random = (limit: number) => limit === 40 ? 0 : limit === 77 ? 60
        : limit === 21 ? 10 : Math.min(1, limit - 1);

    await runMonsterAction(leprechaun, game, random, undefined, sides => sides === 79 ? 62 : 1);

    assert.ok(leprechaun.mx > 40, 'the leprechaun escaped across the dividing wall');
    assert.equal(gold.where, 'buried');
    assert.equal(gold.ox, leprechaun.mx);
    assert.equal(gold.oy, leprechaun.my);
    assert.equal(leprechaun.minvent?.includes(gold), false);
});
