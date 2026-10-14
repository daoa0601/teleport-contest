import type { GasCloud } from '../js/map_types.js';
import type { ObjectRoomOptions } from './support/object-room.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { AD_DRST } from '../js/monster_attack_types.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';

function poisonCloud({ x = 10, y = 10, damage = 8, ttl = 3 } = {}): GasCloud {
    const region = createHarmlessGasCloudSelection(game, [{ x, y }], { ttl });
    assert.ok(region);
    region.damage = damage;
    region.heroFault = false;
    return region;
}

function freshCloudRoom(hero: ObjectRoomOptions['hero'] = {}) {
    freshPlayableRoom({
        hero: { uhp: 40, uhpmax: 40, ...hero },
    });
    requirePlayingGame(game);
    initRng(8101n);
}

void test('an unseen nearby monster coughs without revealing its species', async () => {
    freshObjectRoom();
    const xan = await createMonsterAt('xan', 11, 10);
    xan.minvis = true;
    requireGameLevel().regions = [poisonCloud({ x: 11, y: 10 })];
    const messages: string[] = [];

    await runLevelRegions(game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], 'It coughs!');
});

void test('a poison cloud blinds and hurts a breathing hero', async () => {
    freshCloudRoom();
    requirePlayingGame(game);
    requireGameLevel().regions = [poisonCloud()];
    const messages: string[] = [];

    const events = await runLevelRegions(game, {
        rollOne: () => 3,
        publish: async (message: string) => { messages.push(message); },
        onHeroDeath: async () => {
            throw new Error('the surviving hero must not enter death handling');
        },
    });

    assert.equal(game.u.uhp, 32);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(game.blind, true);
    assert.equal(requireGameLevel().regions[0]?.ttl, 2);
    assert.deepEqual(events, [{
        kind: 'hero-gas', resisted: false, damage: 8,
    }]);
    assert.deepEqual(messages, [
        'Your eyes sting.',
        'Something is burning your lungs!',
        'You cough and spit blood!',
    ]);
});

void test('poison resistance leaves a coughing hero unharmed', async () => {
    freshCloudRoom({ poisonResistance: true });
    requirePlayingGame(game);
    requireGameLevel().regions = [poisonCloud()];
    const messages: string[] = [];

    const events = await runLevelRegions(game, {
        publish: async (message: string) => { messages.push(message); },
    });

    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(events[0]?.resisted, true);
    assert.deepEqual(messages, ['Your eyes sting.', 'You cough!']);
});

void test('poison gas kills a susceptible monster through ordinary death',
    async () => {
        freshCloudRoom();
        requirePlayingGame(game);
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 6;
        requireGameLevel().regions = [poisonCloud({ x: 11, y: 10 })];
        const messages: string[] = [];

        const events = await runLevelRegions(game, {
            rollOne: () => 1,
            publish: async (message: string) => { messages.push(message); },
            onMonsterDeath: monster =>
                finishMonsterKilled(monster, game, {
                    cause: 'gas cloud', damageType: AD_DRST,
                    publish: async (message: string) => { messages.push(message); },
                }),
        });

        assert.equal(jackal.dead, true);
        assert.equal(requireGameLevel().monsters.includes(jackal), false);
        assert.equal(events[0]?.damage, 6);
        assert.deepEqual(messages, [
            'The jackal coughs!',
            'The jackal is killed by the gas cloud!',
        ]);
    });

void test('poison-resistant monsters cough and lose their sight but not HP',
    async () => {
        freshCloudRoom();
        requirePlayingGame(game);
        const killerBee = await createMonsterAt('killer bee', 11, 10);
        const hitPoints = killerBee.mhp;
        requireGameLevel().regions = [poisonCloud({ x: 11, y: 10 })];

        const events = await runLevelRegions(game, {
            publish: async () => {},
        });

        assert.equal(events[0]?.resisted, true);
        assert.equal(killerBee.mhp, hitPoints);
        assert.equal(killerBee.mcansee, 0);
        assert.equal(killerBee.mblinded, 1);
    });

void test('a thick cloud thins before it finally dissipates', async () => {
    freshCloudRoom();
    requirePlayingGame(game);
    requireGameLevel().regions = [poisonCloud({ x: 12, ttl: 0 })];
    const messages: string[] = [];
    const options = { publish: async (message: string) => { messages.push(message); } };

    await runLevelRegions(game, options);
    assert.equal(requireGameLevel().regions[0]?.damage, 4);
    assert.equal(requireGameLevel().regions[0]?.ttl, 1);

    await runLevelRegions(game, options);
    assert.equal(requireGameLevel().regions[0]?.ttl, 0);

    await runLevelRegions(game, options);
    assert.deepEqual(requireGameLevel().regions, []);
    assert.deepEqual(messages, ['You see a gas cloud dissipate.']);
});
