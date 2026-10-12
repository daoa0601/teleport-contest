import { createStaffedShop } from './support/shop.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ICE, STONE } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { GOLD_PIECE, CLUB } from '../js/object_data.js';
import { kickFloorObject } from '../js/object_kick.js';
import { initRng } from '../js/rng.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { kickDirection } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
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


void test('a kicked object slides across ice and grease with visible feedback', async () => {
    const level = freshGameplayRoom({ role: 'tourist', right: 30 });
    requirePlayingGame(game);
    game.u.acurr.a[0] = 18;
    level.requireAt(11, 10).typ = ICE;
    const club = placeCreatedObject(await knownObject(CLUB, { greased: true }), 11, 10);
    const messages: string[] = [];

    await kickFloorObject(11, 10, { dx: 1, dy: 0, rollOne: () => 3,
        publish: message => { messages.push(message); } });

    assert.ok(messages.some(message => /^Whee!  .* slides across the ice\.$/.test(message)));
    assert.equal(club.ox, 25);
});

for (const count of [1, 3]) {
    void test(`a sliding kick preserves a floor stack of ${count} during its announcement`, async () => {
        const level = freshGameplayRoom({ role: 'tourist' });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = ICE;
        await floorObject(CLUB, 11, 10, { quantity: count });
        let announced = false;

        await kickFloorObject(11, 10, { dx: 1, dy: 0, rollOne: () => 1,
            publish: message => {
                if (!message.startsWith('Whee!')) return;
                announced = true;
                assert.equal(floorObjectsAt(level, 11, 10)
                    .reduce((total, object) => total + object.quan, 0), count,
                'The slide announcement must precede removal from the floor.');
            } });

        assert.equal(announced, true);
        assert.equal(floorObjectsAt(level, 11, 10)
            .reduce((total, object) => total + object.quan, 0), count - 1);
        assert.equal(floorObjects(level)
            .reduce((total, object) => total + object.quan, 0), count);
    });
}

void test('kicking a pile of coins scatters that pile and leaves other objects alone', async () => {
    const level = freshGameplayRoom({ role: 'tourist', hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const club = placeCreatedObject(await knownObject(CLUB), 11, 10);
    placeCreatedObject(await knownObject(GOLD_PIECE, { quantity: 600 }), 11, 10);
    const messages: string[] = [];
    initRng(7n);

    await kickFloorObject(11, 10, { dx: 1, dy: 0,
        publish: message => { messages.push(message); } });

    assert.ok(messages.includes('Thwwpingg!'));
    assert.ok(messages.some(message => /coins.*!$/.test(message)));
    const coins = floorObjects(level).filter(object => object.otyp === GOLD_PIECE);
    assert.equal(coins.reduce((sum, object) => sum + object.quan, 0), 600);
    assert.ok(coins.some(object => object.oy !== 10));
    assert.equal(club.ox, 11);
    assert.equal(club.oy, 10);
});

void test('scattered coins only hit the hero when their accuracy exceeds the armor roll', async () => {
    freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    game.u.uac = 10;
    placeCreatedObject(await knownObject(GOLD_PIECE, { quantity: 5 }), 11, 10);
    const messages: string[] = [];

    await kickFloorObject(11, 10, { dx: 1, dy: 0,
        random: limit => limit === 8 ? 0 : 1,
        rollOne: sides => sides === 20 ? 18 : sides,
        publish: message => { messages.push(message); } });

    assert.equal(messages.some(message => /You are hit by/.test(message)), false);
    assert.ok(messages.some(message => /almost hit|misses you/.test(message)));
});


void test('coins scattered out of a shop are charged and reported together', async () => {
    freshGameplayRoom({ role: 'tourist' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ left: 9, right: 11, keeperX: 10, keeperY: 9 });
    placeCreatedObject(await knownObject(GOLD_PIECE, { quantity: 20 }), 11, 10);
    const messages: string[] = [];

    await kickFloorObject(11, 10, { dx: 1, dy: 0,
        random: limit => limit === 8 ? 4 : 1,
        rollOne: sides => sides,
        publish: message => { messages.push(message); } });

    assert.equal(shopkeeper.eshk.debit, 20);
    assert.ok(messages.includes('Your debt has increased by 20 zorkmids.'));
});

void test('a heavy coin pile that stays together can hurt the kicker', async () => {
    let injured = false;
    for (let seed = 1n; seed <= 100n; seed++) {
        const level = freshGameplayRoom({ role: 'tourist', hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const gold = placeCreatedObject(await knownObject(GOLD_PIECE, { quantity: 500 }), 11, 10);
        initRng(seed);

        await kickDirection('l', ' '.repeat(10));

        if (gold.quan === 500 && gold.ox === 11 && gold.oy === 10) {
            assert.ok(floorObjects(level).includes(gold));
            if (game.u.uhp < 100) { injured = true; break; }
        }
    }
    assert.equal(injured, true, 'a failed heavy-pile kick must sometimes injure the hero');
});
