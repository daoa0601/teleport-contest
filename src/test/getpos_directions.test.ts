import assert from 'node:assert/strict';
import test from 'node:test';

import { DOOR, D_NODOOR } from '../js/const.js';
import { newsym } from '../js/display.js';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a vertical feature key clears the direction used to choose a doorway area', async () => {
    const level = freshObjectRoom({
        hero: { dx: 1, dy: 0 }, iflags: { getloc_filter: 2 },
    });
    level.requireAt(10, 10).typ = DOOR;
    level.requireAt(10, 10).doormask = D_NODOOR;
    await createMonsterAt('kitten', 12, 10);
    newsym(12, 10);
    resetInputState().feed('<m.');

    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    });

    assert.equal(selected?.x, 10);
    assert.equal(game.u.dx, 1, 'Targeting restores the hero movement direction on exit');
});

for (const prefix of ['g', 'G']) {
    void test(`Escape after the ${prefix} movement prefix leaves forced targeting active`, async () => {
        freshObjectRoom();
        resetInputState().feed(`${prefix}\x1bl.`);

        const selected = await selectMapPosition({
            start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        });

        assert.equal(selected?.x, 11);
    });
}

