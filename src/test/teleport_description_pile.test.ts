import assert from 'node:assert/strict';
import test from 'node:test';
import { askMonsterTeleportDestination, askTeleportDestination } from '../js/cmd.js';
import { STAIRS } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

for (const subject of ['hero', 'monster']) {
    for (const verbose of [false, true]) {
        void test(`accepting a ${subject} teleport clears its prompt with autodescribe off and verbose ${verbose}`, async () => {
            freshObjectRoom({
                flags: { tips: false, verbose }, iflags: { autodescribe: false },
            });
            const monster = subject === 'monster'
                ? await createMonsterAt('kitten', 11, 10) : null;
            const input = resetInputState();
            const selection = monster
                ? askMonsterTeleportDestination(monster, { x: 12, y: 10 })
                : askTeleportDestination();
            await input.waitUntilBlocked();
            try {
                const prompt = requireScreenRow(0).map(cell => cell.ch).join('');
                assert.match(prompt, verbose ? /For instructions/ : /[Tt]eleport/);
            } finally {
                input.feed('.');
                await selection;
            }

            assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '');
        });
    }
}

void test('finding a stair by its symbol leaves the teleport message blank with autodescribe off', async () => {
    const level = freshObjectRoom({
        flags: { tips: false, verbose: false }, iflags: { autodescribe: false },
    });
    level.requireAt(11, 10).typ = STAIRS;
    level.upstair = { x: 11, y: 10 };
    const input = resetInputState();
    input.feed('<');

    const selection = askTeleportDestination();
    await input.waitUntilBlocked();
    try {
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '',
            'Finding the stair must clear the prompt before the next position input.');
    } finally {
        input.feed('.');
        await selection;
    }

    const destination = await selection;
    assert.equal(destination?.x, 11);
    assert.equal(destination?.y, 10);
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '');
});

void test('a stair search after redraw preserves the restored targeting prompt with autodescribe off', async () => {
    const level = freshObjectRoom({
        flags: { tips: false, verbose: false }, iflags: { autodescribe: false },
    });
    level.requireAt(11, 10).typ = STAIRS;
    level.upstair = { x: 11, y: 10 };
    const input = resetInputState();
    input.feed('<\x12<');

    const selection = askTeleportDestination();
    await input.waitUntilBlocked();
    try {
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(),
            'Move cursor to the desired position:');
    } finally {
        input.feed('.');
        await selection;
    }

    const destination = await selection;
    assert.equal(destination?.x, 11);
    assert.equal(destination?.y, 10);
});

void test('a chosen teleport description remains visible beside a corner floor-pile window', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    const location = level.requireAt(11, 10);
    location.typ = STAIRS;
    level.upstair = { x: 11, y: 10 };
    newsym(11, 10);
    const apple = await floorObject(APPLE, 10, 10);
    const dagger = await floorObject(DAGGER, 10, 10);
    const input = resetInputState();
    input.feed('l.');

    const destination = await askTeleportDestination();
    await flush_screen(1);
    assert.equal(destination?.x, 11);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /^staircase up/);
    assert.equal(game._pending_message, '', 'The chosen description needs no further acknowledgment.');
    const pile = showFloorPile([dagger, apple], false, 'There is a staircase up here.');
    await input.waitUntilBlocked();
    try {
        const row = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.match(row, /^staircase up\s+There is a staircase up here\./);
    } finally {
        input.feed(' ');
        await pile;
    }
});
