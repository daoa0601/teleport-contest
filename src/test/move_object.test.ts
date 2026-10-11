import test from 'node:test';
import assert from 'node:assert/strict';

// Native ESM imports of both sides of the floor_object <-> monmove cycle.
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    moveObject, placeCreatedObject,
} from '../js/floor_object.js';
import { maybeUnhideAt } from '../js/monster_hiding.js';
import { CHEST } from '../js/object_data.js';
import { MM_IGNOREWATER, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObjectsAt } from './support/level-state.js';
import {
    MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SYMBOL,
} from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';

const SCORPION = MONSTER_NAME.indexOf('scorpion');
const S_EEL = MONSTER_SYMBOL[MONSTER_NAME.indexOf('giant eel')];

async function hiddenMonsterAt(mnum: number, x: number, y: number, { trapped = false } = {}) {
    const monster = await createMonsterAt(mnum, x + 1, y, MM_IGNOREWATER | MM_NOGRP | NO_MINVENT);
    placeMonsterAt(monster, x, y);
    monster.mundetected = 1;
    monster.mtrapped = trapped ? 1 : 0;
    monster.mhp = 10;
    monster.mhpmax = 10;
    return monster;
}

void test('moving an object reowns its floor pile in one step', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await knownObject(CHEST);
    placeCreatedObject(chest, 10, 10, game);

    await moveObject(chest, 12, 12, game);

    assert.deepEqual(floorObjectsAt(game.level, 10, 10), []);
    assert.equal(floorObjectsAt(game.level, 12, 12)[0], chest);
    assert.equal(chest.ox, 12);
    assert.equal(chest.oy, 12);
    assert.equal(chest.where, 'floor');
});

void test('a hider under the moved object is silently exposed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await knownObject(CHEST);
    placeCreatedObject(chest, 10, 10, game);
    const scorpion = await hiddenMonsterAt(SCORPION, 10, 10);

    await moveObject(chest, 12, 12, game);

    assert.equal(scorpion.mundetected, 0);
});

void test('a hider whose cover remains stays hidden', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const moved = await knownObject(CHEST);
    const cover = await knownObject(CHEST);
    placeCreatedObject(moved, 10, 10, game);
    placeCreatedObject(cover, 10, 10, game);
    const scorpion = await hiddenMonsterAt(SCORPION, 10, 10);

    await moveObject(moved, 12, 12, game);

    assert.equal(scorpion.mundetected, 1);
});

void test('a trapped hider under remaining cover is exposed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await knownObject(CHEST);
    placeCreatedObject(chest, 10, 10, game);
    const scorpion = await hiddenMonsterAt(SCORPION, 10, 10, { trapped: true });

    await moveObject(chest, 12, 12, game);

    assert.equal(scorpion.mundetected, 0);
});

void test('a hidden eel out of water is exposed at its square', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const eel = await hiddenMonsterAt(MONSTER_NAME.indexOf('giant eel'), 10, 10);
    assert.equal(MONSTER_SYMBOL[eel.mnum], S_EEL);

    maybeUnhideAt(10, 10, game);

    assert.equal(eel.mundetected, 0);
});

void test('a hidden hero under the vacated object is exposed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const chest = await knownObject(CHEST);
    placeCreatedObject(chest, 10, 10, game);
    game.u.ux = 10;
    game.u.uy = 10;
    game.u.uundetected = 1;
    game.u.umonnum = SCORPION;

    await moveObject(chest, 12, 12, game);

    assert.equal(game.u.uundetected, 0);
});
