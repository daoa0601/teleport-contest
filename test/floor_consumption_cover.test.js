import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { useUpFloorObject } from '../js/floor_consumption.js';
import { CORPSE, ROCK } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('using up safe cover exposes a hero left under only petrifying corpses', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    installPolymorphedHero('garter snake');
    await floorObject(CORPSE, 10, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const cover = await floorObject(ROCK, 10, 10);
    game.u.uundetected = 1;
    await useUpFloorObject(cover, 1);
    assert.equal(game.u.uundetected, 0);
});
void test('using up part of the cover leaves a hiding hero hidden', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    installPolymorphedHero('garter snake');
    const cover = await floorObject(ROCK, 10, 10, { quantity: 2 });
    game.u.uundetected = 1;
    await useUpFloorObject(cover, 1);
    assert.equal(cover.quan, 1);
    assert.equal(game.u.uundetected, 1);
});
//# sourceMappingURL=floor_consumption_cover.test.js.map