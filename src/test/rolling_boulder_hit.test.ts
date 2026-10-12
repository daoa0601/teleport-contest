import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { initRng, rn2 } from '../js/rng.js';
import { launchRollingBoulder } from '../js/rolling_boulder.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a killed acid blob cannot affect whether the rolling boulder fills the next pool', async () => {
    for (let seed = 1n; seed <= 16n; seed++) {
        const poolTypes: number[] = [];
        for (const withBlob of [false, true]) {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            const pool = level.requireAt(14, 10);
            pool.typ = POOL;
            const blob = withBlob ? await createMonsterAt('acid blob', 13, 10, NO_MINVENT) : null;
            if (blob) blob.mhp = 1;
            await floorObject(BOULDER, 12, 10);
            initRng(seed);

            await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
                state: game, publish: async () => {}, rollOne: () => 1,
                // Suppress the optional corpse so both paths reach an empty pool.
                random: limit => limit === 3 ? 2 : rn2(limit),
            });

            if (blob) assert.equal(level.monsters.includes(blob), false, `blob must die, seed ${seed}`);
            poolTypes.push(pool.typ);
        }
        assert.equal(poolTypes[1], poolTypes[0], `dead acid must not change pool filling, seed ${seed}`);
    }
});

for (const hallucinating of [false, true]) {
    void test(`seeing a boulder hit ${hallucinating ? 'while hallucinating leaves its appearance unknown' : 'reveals its appearance'}`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: hallucinating ? 100 : 0 } });
        requirePlayingGame(game);
        const orc = await createMonsterAt('orc', 13, 10, NO_MINVENT);
        orc.mhp = orc.mhpmax = 100;
        const boulder = await floorObject(BOULDER, 12, 10, { dknown: false });

        await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
            state: game, publish: async () => {}, rollOne: () => 1,
        });

        assert.equal(boulder.dknown, !hallucinating);
        assert.equal(game._encounteredObjectTypes?.has(BOULDER) ?? false, !hallucinating);
    });
}

for (const verbose of [false, true]) {
    for (const hit of [false, true]) {
        void test(`a boulder ${hit ? 'hit' : 'miss'} ${verbose ? 'names a visible target' : 'uses it when verbose is disabled'}`, async () => {
            freshObjectRoom({ flags: { verbose } });
            requirePlayingGame(game);
            const wolf = await createMonsterAt('wolf', 13, 10, NO_MINVENT);
            wolf.mhp = wolf.mhpmax = 100;
            await floorObject(BOULDER, 12, 10);
            const messages: string[] = [];

            await launchRollingBoulder({ x: 12, y: 10 }, { x: 14, y: 10 }, {
                state: game, publish: async message => { messages.push(message); },
                rollOne: sides => hit || sides !== 20 ? 1 : 20,
            });

            assert.equal(messages[0], `The boulder ${hit ? 'hits' : 'misses'} ${verbose ? 'the wolf' : 'it'}.`);
        });
    }
}
