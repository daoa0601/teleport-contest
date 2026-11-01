import assert from 'node:assert/strict';
import test from 'node:test';
import { breakFloorObject } from '../js/object_breakage.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { resetInputState } from '../js/input.js';
import { monsterAtPosition } from '../js/steed.js';
import { EXPENSIVE_CAMERA } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C dothrow.c:release_camera_demon() summons rn2(3) ? homunculus : imp when a
// breaking camera's !rn2(3) gate passes.  A neuter stand-in such as a lemure
// would skip makemon()'s gender roll (makemon.c:1279), so only the two
// gender-random picture-painting demons may appear.
void test('a breaking camera releases an imp or a homunculus, never another demon', async () => {
    const released: string[] = [];
    for (let seed = 1n; seed <= 40n; seed++) {
        await freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        input.feed(' '.repeat(4));
        const camera = await floorObject(EXPENSIVE_CAMERA, 11, 10);
        initRng(seed);

        await breakFloorObject(camera, { x: 11, y: 10 });
        const demon = monsterAtPosition(requireGameLevel(), 11, 10, game);
        if (demon) released.push(MONSTER_NAME[demon.mnum] ?? `species ${demon.mnum}`);
    }
    assert.ok(released.length > 0, 'At least one camera released its demon');
    for (const name of released)
        assert.ok(name === 'imp' || name === 'homunculus',
            `The camera released ${name}, not one of the two picture-painting demons`);
});
