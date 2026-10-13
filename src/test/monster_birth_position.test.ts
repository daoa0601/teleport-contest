import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ADJACENTOK, MM_NOGRP, MM_NOMSG, NO_MINVENT, ROOM, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const RAT = MONSTER_NAME.indexOf('sewer rat');
const BIRTH_FLAGS = MM_NOGRP | MM_NOMSG | NO_MINVENT;

void test('requesting a monster on the hero places it nearby and remembers the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);

    const rat = await makemonAt(RAT, game.u.ux, game.u.uy, BIRTH_FLAGS);

    assert.ok(rat);
    assert.ok(rat.mx !== game.u.ux || rat.my !== game.u.uy);
    assert.equal(Math.max(Math.abs(rat.mx - game.u.ux), Math.abs(rat.my - game.u.uy)), 1);
    assert.equal(rat.mux, game.u.ux);
    assert.equal(rat.muy, game.u.uy);
});

void test('near-hero birth searches beyond the adjacent ring when it is blocked', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx || dy) level.requireAt(ux + dx, uy + dy).typ = STONE;
        }
    }
    level.requireAt(ux + 2, uy).typ = ROOM;

    const rat = await makemonAt(RAT, ux, uy, BIRTH_FLAGS);

    assert.ok(rat);
    assert.equal(Math.max(Math.abs(rat.mx - ux), Math.abs(rat.my - uy)), 2);
});

void test('MM_ADJACENTOK permits birth beside an occupied requested square', async () => {
    freshObjectRoom();
    const occupant = await createMonsterAt('goblin', 12, 10, BIRTH_FLAGS);

    const rat = await makemonAt(RAT, 12, 10, BIRTH_FLAGS | MM_ADJACENTOK);

    assert.ok(rat);
    assert.ok(rat.mx !== occupant.mx || rat.my !== occupant.my);
    assert.equal(Math.max(Math.abs(rat.mx - occupant.mx), Math.abs(rat.my - occupant.my)), 1);
});

void test('birth fails at an occupied explicit square without MM_ADJACENTOK', async () => {
    const level = freshObjectRoom();
    await createMonsterAt('goblin', 12, 10, BIRTH_FLAGS);
    const count = level.monsters.length;

    assert.equal(await makemonAt(RAT, 12, 10, BIRTH_FLAGS), null);
    assert.equal(level.monsters.length, count);
});
