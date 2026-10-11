import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { STONE } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { kickDirection } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('kicking a loose object moves its existing identity', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const club = placeCreatedObject(await knownObject(CLUB, { spe: 0 }), 11, 10);
    await kickDirection('l');
    assert.equal(floorObjects(level).filter(object => object === club).length, 1);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const restored = floorObjects(game.level).filter(object => object.o_id === club.o_id);
    assert.equal(restored.length, 1);
    assert.ok(restored[0]);
    assert.deepEqual([restored[0].ox, restored[0].oy], [15, 10]);
});
void test('an object cannot be kicked through a wall', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const club = placeCreatedObject(await knownObject(CLUB, { spe: 0 }), 11, 10);
    level.requireAt(12, 10).typ = STONE;
    installPagerInput(resetInputState(), { expected: /Thump|club|kick/i, limit: 1 });
    await kickDirection('l');
    assert.deepEqual([club.ox, club.oy], [11, 10]);
    assert.equal(floorObjects(level).includes(club), true);
});
void test('a kicked object can fall down a ladder during flight', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const club = placeCreatedObject(await knownObject(CLUB, { spe: 0 }), 11, 10);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 2 })];
    game.stairs = {
        sx: 13,
        sy: 10,
        up: false,
        isladder: true,
        tolev: { dnum: 0, dlevel: 2 },
        next: null, u_traversed: false,
    };
    installPagerInput(resetInputState(), { expected: /club|ladder|falls/i, limit: 1 });
    await kickDirection('l');
    assert.equal(floorObjects(level).includes(club), false);
    assert.equal(club.where, 'migrating');
});
void test('a kicked club can hit a monster before it lands', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const club = placeCreatedObject(await knownObject(CLUB, { spe: 0 }), 11, 10);
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = 20;
    jackal.mhpmax = 20;
    jackal.mcanmove = 0;
    jackal.movement = 12;
    initRng(1n);
    installPagerInput(resetInputState(), { expected: /club.*(?:hits|misses).*jackal|jackal.*(?:hit|wake)/i, limit: 2 });
    await kickDirection('l');
    assert.ok(jackal.mhp < 20);
    assert.deepEqual([club.ox, club.oy], [13, 10]);
    assert.equal(floorObjects(level).includes(club), true);
});
//# sourceMappingURL=object_kick.test.js.map