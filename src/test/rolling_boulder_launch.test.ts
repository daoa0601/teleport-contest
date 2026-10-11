import test from 'node:test';
import assert from 'node:assert/strict';

import { LAVAPOOL, POOL, ROLLING_BOULDER_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { maketrap } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshTurnRoom } from './support/playable-room.js';

// trap.c find_random_launch_coord()/isclearpath(): the boulder's line may
// cross pools and lava (ZAP_POS terrain); only the launch square itself
// must not be pool or lava.
for (const [label, liquid] of [['pool', POOL], ['lava', LAVAPOOL]] as const) {
    void test(`a rolling boulder trap launches across ${label} but never from it`, async () => {
        for (const seed of [1n, 2n, 3n, 4n, 5n, 6n]) {
            freshTurnRoom({ left: 2, right: 30, top: 10, bottom: 10, heroX: 2, heroY: 10 });
            requirePlayingGame(game);
            const level = game.level;
            for (const x of [13, 14, 16, 17]) level.requireAt(x, 10).typ = liquid;
            initRng(seed);

            const trap = await maketrap(15, 10, ROLLING_BOULDER_TRAP);

            assert.ok(trap);
            const boulders: { x: number; y: number }[] = [];
            for (let x = 0; x < level.objects.length; x++)
                for (let y = 0; y < (level.objects[x]?.length ?? 0); y++)
                    if ((level.objects[x]?.[y] ?? []).some(object => object.otyp === BOULDER)) boulders.push({ x, y });
            assert.equal(boulders.length, 1, `seed ${seed}: the only launch lines cross ${label}, which is allowed`);
            const [boulder] = boulders;
            assert.ok(boulder);
            assert.deepEqual(trap.launch, boulder, 'the boulder waits at the launch point');
            assert.notEqual(level.requireAt(boulder.x, boulder.y).typ, liquid, `seed ${seed}: never launched from ${label}`);
        }
    });
}
