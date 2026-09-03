import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { runLevelRegions } from '../js/regions.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

function poisonCloud({ x = 10, y = 10, damage = 8, ttl = 3 } = {}) {
    return {
        kind: 'gas-cloud',
        visible: true,
        heroFault: false,
        damage,
        ttl,
        cells: [{ x, y }],
    };
}

function freshCloudRoom(hero = {}) {
    freshPlayableRoom({
        hero: { uhp: 40, uhpmax: 40, ...hero },
    });
    initRng(8101n);
}

test('a poison cloud blinds and hurts a breathing hero', async () => {
    freshCloudRoom();
    game.level.regions = [poisonCloud()];
    const messages = [];

    const events = await runLevelRegions(game, {
        rollOne: () => 3,
        publish: async message => messages.push(message),
        onHeroDeath: async () => {
            throw new Error('the surviving hero must not enter death handling');
        },
    });

    assert.equal(game.u.uhp, 32);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(game.blind, true);
    assert.equal(game.level.regions[0].ttl, 2);
    assert.deepEqual(events, [{
        kind: 'hero-gas', resisted: false, damage: 8,
    }]);
    assert.deepEqual(messages, [
        'Your eyes sting.',
        'Something is burning your lungs!',
        'You cough and spit blood!',
    ]);
});

test('poison resistance leaves a coughing hero unharmed', async () => {
    freshCloudRoom({ poisonResistance: true });
    game.level.regions = [poisonCloud()];
    const messages = [];

    const events = await runLevelRegions(game, {
        publish: async message => messages.push(message),
    });

    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(events[0].resisted, true);
    assert.deepEqual(messages, ['Your eyes sting.', 'You cough!']);
});

test('poison gas kills a susceptible monster through ordinary death',
    async () => {
        freshCloudRoom();
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 6;
        game.level.regions = [poisonCloud({ x: 11, y: 10 })];
        const messages = [];

        const events = await runLevelRegions(game, {
            rollOne: () => 1,
            publish: async message => messages.push(message),
            onMonsterDeath: (monster, event) =>
                finishEnvironmentalMonsterDeath(monster, game, {
                    deathMessage: event.visible
                        ? 'The jackal dies from the gas cloud!' : null,
                    visible: event.visible,
                    spotted: event.visible,
                    publish: async message => messages.push(message),
                }),
        });

        assert.equal(jackal.dead, true);
        assert.equal(game.level.monsters.includes(jackal), false);
        assert.equal(events[0].damage, 6);
        assert.deepEqual(messages, [
            'The jackal coughs!',
            'The jackal dies from the gas cloud!',
        ]);
    });

test('poison-resistant monsters cough and lose their sight but not HP',
    async () => {
        freshCloudRoom();
        const killerBee = await createMonsterAt('killer bee', 11, 10);
        const hitPoints = killerBee.mhp;
        game.level.regions = [poisonCloud({ x: 11, y: 10 })];

        const events = await runLevelRegions(game, {
            publish: async () => {},
        });

        assert.equal(events[0].resisted, true);
        assert.equal(killerBee.mhp, hitPoints);
        assert.equal(killerBee.mcansee, 0);
        assert.equal(killerBee.mblinded, 1);
    });

test('a thick cloud thins before it finally dissipates', async () => {
    freshCloudRoom();
    game.level.regions = [poisonCloud({ x: 12, ttl: 0 })];
    const messages = [];
    const options = { publish: async message => messages.push(message) };

    await runLevelRegions(game, options);
    assert.equal(game.level.regions[0].damage, 4);
    assert.equal(game.level.regions[0].ttl, 1);

    await runLevelRegions(game, options);
    assert.equal(game.level.regions[0].ttl, 0);

    await runLevelRegions(game, options);
    assert.deepEqual(game.level.regions, []);
    assert.deepEqual(messages, ['You see a gas cloud dissipate.']);
});
