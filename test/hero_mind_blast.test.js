import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { useHeroMindBlast } from '../js/hero_mind_blast.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';

function installMindFlayerHero(energy = 20) {
    freshRoomWithPolymorphedHero('mind flayer', {
        left: 2,
        right: 24,
        top: 4,
        bottom: 16,
        polymorph: {
            uen: energy,
            uenmax: energy,
        },
    });
}

test('a mind flayer uses #monster to strike nearby hostile minds', async () => {
    installMindFlayerHero();
    const target = addMonster({
        species: 'floating eye',
        x: 11,
        y: 10,
        hitPoints: 1,
        mcansee: 0,
    });
    const mindless = addMonster({
        species: 'straw golem',
        x: 12,
        y: 10,
        hitPoints: 20,
    });
    const peaceful = addMonster({
        species: 'floating eye',
        x: 13,
        y: 10,
        hitPoints: 20,
        mcansee: 0,
        mpeaceful: 1,
    });
    const distant = addMonster({
        species: 'floating eye',
        x: 19,
        y: 10,
        hitPoints: 20,
        mcansee: 0,
    });
    initRng(7n);
    pushKeys(`monster\n${' '.repeat(20)}`);

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.uen, 10);
    assert.equal(game.context.move, 1);
    assert.equal(game.level.monsters.includes(target), false);
    assert.equal(mindless.mhp, 20);
    assert.equal(peaceful.mhp, 20);
    assert.equal(distant.mhp, 20);
});

test('blind and sighted telepaths are found by their source chances',
    async () => {
        installMindFlayerHero();
        const blindEye = addMonster({
            species: 'floating eye',
            x: 11,
            y: 10,
            hitPoints: 20,
            mcansee: 0,
        });
        const sightedFlayer = addMonster({
            species: 'master mind flayer',
            x: 12,
            y: 10,
            hitPoints: 20,
        });
        const jackal = addMonster({
            species: 'jackal',
            x: 13,
            y: 10,
            hitPoints: 20,
        });

        await useHeroMindBlast({
            state: game,
            publish: async () => {},
            random: () => 1,
            rollDamage: () => 4,
        });

        assert.equal(blindEye.mhp, 16);
        assert.equal(sightedFlayer.mhp, 16);
        assert.equal(jackal.mhp, 20);
    });

test('trying to mind blast without enough energy takes no time', async () => {
    installMindFlayerHero(9);
    const messages = [];

    const result = await useHeroMindBlast({
        state: game,
        publish: async message => messages.push(message),
    });

    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 9);
    assert.deepEqual(messages, [
        'You concentrate but lack the energy to maintain doing so.',
    ]);
});
