import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { CHEST, CLUB, POT_WATER } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a heavy chest absorbs a kick without injuring the hero', async () => {
    freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 3;
    const chest = await floorObject(CHEST, 11, 10, { initialize: false, olocked: true });

    await kickDirection('l', ' '.repeat(10));

    assert.equal(game.u.uhp, 100);
    assert.equal(chest.ox, 11);
    assert.match(game._pending_message, /THUD!/);
});

void test('kicking a chest can break its lock without moving it', async () => {
    let opened = false;
    for (let seed = 1n; seed <= 30n && !opened; seed++) {
        freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const chest = await floorObject(CHEST, 11, 10, { initialize: false, olocked: true });

        await kickDirection('l', ' '.repeat(10));

        if (!chest.olocked) {
            opened = true;
            assert.equal(chest.obroken, true);
            assert.equal(chest.lknown, true);
            assert.equal(chest.ox, 11);
            assert.match(game._pending_message, /You break open the lock!/);
        }
    }
    assert.ok(opened, 'Some kicks must break the chest lock.');
});

void test('kicking a chest can shatter its fragile contents', async () => {
    let shattered = false;
    for (let seed = 1n; seed <= 30n && !shattered; seed++) {
        freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const chest = await floorObject(CHEST, 11, 10, { initialize: false, cknown: true });
        const potion = await knownObject(POT_WATER, { initialize: false });
        await addCreatedObjectToContainer(chest, potion);

        await kickDirection('l', ' '.repeat(10));

        if (potion.where === 'gone') {
            shattered = true;
            assert.equal(chest.cknown, false);
            assert.ok(!chest.contents?.includes(potion));
            assert.match(game._pending_message, /muffled shatter/);
        }
    }
    assert.ok(shattered, 'Some kicks must shatter glass inside an ordinary chest.');
});

void test('an object embedded in rock can come loose onto the hero square', async () => {
    let loosened = false;
    for (let seed = 1n; seed <= 30n && !loosened; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        level.requireAt(11, 10).typ = STONE;
        const club = await floorObject(CLUB, 11, 10, { initialize: false });

        await kickDirection('l', ' '.repeat(10));

        if (club.ox === 10) {
            loosened = true;
            assert.equal(club.oy, 10);
            assert.match(game._pending_message, /comes loose/);
        }
    }
    assert.ok(loosened, 'A kick can dislodge an embedded object toward the hero.');
});
