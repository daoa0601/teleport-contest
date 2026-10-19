import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { MACE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('viewing a short inventory leaves an unflagged energy change off the status line', async () => {
    freshObjectRoom();
    await addInventoryObject(MACE);
    await bot();
    const energy = game.u.uenmax ?? 0;
    const shown = `Pw:${game.u.uen}(${energy})`;
    // trap.c's magical explosion raises energy without requesting a botl update.
    game.u.uenmax = game.u.uen = energy + 2;
    pushKeys('\x1b');

    await ddoinv();

    assert.ok(requireScreenRow(23).map(cell => cell.ch).join('').includes(shown));
});
