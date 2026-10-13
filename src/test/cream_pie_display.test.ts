import assert from 'node:assert/strict';
import test from 'node:test';

import { useCreamPie } from '../js/cream_pie.js';
import { flush_screen, newsym } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { CREAM_PIE } from '../js/object_data.js';
import { heroIsBlind } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('applying a cream pie clears visible monsters before its blindness message pages', async () => {
    const level = freshObjectRoom();
    level.flags.hero_memory = true;
    await createMonsterAt('kitten', 11, 10);
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, 'f');
    const pie = await addInventoryObject(CREAM_PIE);
    const input = resetInputState();
    const applying = useCreamPie(pie);
    await input.waitUntilBlocked();
    const cell = requireScreenCell(10, 11).ch;
    const blind = heroIsBlind();
    input.feed(' ');
    await applying;

    assert.equal(blind, true);
    assert.equal(cell, '.');
    assert.equal(pie.where, 'gone');
});
