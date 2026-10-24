import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { THRONE } from '../js/const.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { setPropertyTimeout } from '../js/properties.js';
import { autopickupAtHero } from '../js/pickup.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('mention_decor describes an arrival feature when autopickup finds nothing', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: true, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;

    await autopickupAtHero();

    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
    assert.equal(game._prevDecorType, THRONE);
});

void test('furniture decor repeats because same-terrain suppression skips furniture', async () => {
    const level = freshPlayableRoom({ flags: { mention_decor: true, verbose: true } });
    level.requireAt(10, 10).typ = THRONE;

    await autopickupAtHero();
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');

    game._prevDecorType = THRONE;
    await autopickupAtHero();
    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
});

void test('a hero who cannot reach the floor still hears the feature underneath', async () => {
    const level = freshPlayableRoom({ flags: { verbose: true } });
    level.requireAt(10, 10).typ = THRONE;
    await floorObject(GOLD_PIECE, 10, 10, { quan: 5 });
    setPropertyTimeout('levitation', 10);

    await autopickupAtHero();

    assert.equal(game._lastPlineMessage, 'There is an opulent throne here.');
    assert.equal(game.inventory.length, 0);
});
