import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { A_CON, A_STR, Upolyd } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { poisonHero } from '../js/poison.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('surviving severe poison lowers maximum HP and attributes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const messages: string[] = [];

    await poisonHero({
        reason: "The killer bee's sting",
        killer: 'killer bee',
        attribute: A_STR,
        random: () => 0,
        rollDice: () => 4,
        publish: message => {
            messages.push(message);
        },
    });

    assert.equal(game.u.uhpmax, 35);
    assert.equal(game.u.uhp, 30);
    assert.equal(game.u.acurr.a[A_CON], 11);
    assert.equal(game.u.acurr.a[A_STR], 9);
    assert.ok(messages.includes('You feel very sick!'));
    assert.ok(messages.includes('You feel weaker!'));
});

void test('ordinary poison damages the current monster body', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('minotaur');

    await poisonHero({
        reason: 'sting', killer: 'killer bee', attribute: A_STR,
        random: range => range === 30 ? 6 : 0,
        publish: async () => {},
    });

    assert.equal(game.u.mh, 34);
    assert.equal(game.u.uhp, 40);
});

void test('poison can destroy a monster body without killing the human underneath', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 5 });

    await poisonHero({
        reason: 'sting', killer: 'killer bee', attribute: A_STR,
        random: range => range === 30 ? 6 : 0,
        publish: async () => {},
    });

    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, 40);
    assert.equal(!!game.program_state.gameover, false);
});

void test('severe poison lowers human maximum health even while polymorphed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('minotaur');

    await poisonHero({
        reason: 'sting', killer: 'killer bee', attribute: A_STR,
        random: () => 0, rollDice: () => 4,
        publish: async () => {},
    });

    assert.equal(game.u.uhpmax, 35);
    assert.equal(game.u.uhp, 35);
    assert.equal(game.u.mhmax, 40);
    assert.equal(game.u.mh, 30);
});

for (const reason of ['blast', 'gas cloud']) {
    void test(`half gas damage reduces poison from a ${reason}`, async () => {
        freshObjectRoom({ hero: { halfGasDamage: true } });
        requirePlayingGame(game);

        await poisonHero({
            reason, killer: 'cloud of poison gas', attribute: A_STR,
            random: range => range === 30 ? 6 : 0,
            publish: async () => {},
        });

        assert.equal(game.u.uhp, 37);
    });
}

void test('severe poison can trigger life saving through low human health while polymorphed', async () => {
    freshObjectRoom({ hero: { uhp: 10, uhpmax: 40 } });
    requirePlayingGame(game);
    installPolymorphedHero('minotaur', { hitPoints: 60 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    pushKeys('  ');

    await poisonHero({
        reason: 'sting', killer: 'killer bee', attribute: A_STR,
        random: () => 0, rollDice: () => 4,
        publish: async () => {},
    });

    assert.equal(game.u.umortality, 1);
    assert.ok(game.u.uhp > 0);
    assert.ok(game.u.mh > 0);
    assert.equal(game.inventory.includes(amulet), false);
});
