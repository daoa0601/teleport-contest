import assert from 'node:assert/strict';
import test from 'node:test';
import { useCreamPie } from '../js/cream_pie.js';
import { bot, flush_screen } from '../js/display.js';
import { pushKeys } from '../js/input.js';
import { CREAM_PIE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('applying a cream pie displays blindness before the next command', async () => {
    freshObjectRoom();
    const pie = await addInventoryObject(CREAM_PIE);
    await bot();
    pushKeys(' ');

    await useCreamPie(pie);
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Blind\b/);
});
