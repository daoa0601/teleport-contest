import assert from 'node:assert/strict';
import test from 'node:test';
import { MON_FLOOR, MON_MIGRATING, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { updateMonsterLastMove } from '../js/monster_migration.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C dog.c:update_mlstmv() uses mon.c:iter_mons(), including its admission rules.
void test('level departure anchors catchup only for living monsters on the floor', async () => {
    await freshObjectRoom();
    const resident = await createMonsterAt('lichen', 12, 10, NO_MINVENT);
    const dead = await createMonsterAt('lichen', 13, 10, NO_MINVENT);
    const migrating = await createMonsterAt('lichen', 14, 10, NO_MINVENT);
    resident.mstate = MON_FLOOR;
    dead.mhp = 0;
    migrating.mstate = MON_MIGRATING;
    resident.mlstmv = 10;
    dead.mlstmv = 11;
    migrating.mlstmv = 12;
    game.moves = 50;

    updateMonsterLastMove();

    assert.equal(resident.mlstmv, 50, 'the resident starts catchup at departure');
    assert.equal(dead.mlstmv, 11, 'dead monsters retain their last active turn');
    assert.equal(migrating.mlstmv, 12, 'off-map monsters retain their earlier catchup anchor');
});
