import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT, TELEP_TRAP } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { teleportMonsterFromTrap } from '../js/teleport.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

void test('seeing a monster teleport reveals the trap on the square it left', async () => {
    const level = freshObjectRoom();
    const monster = await createMonsterAt('newt', 11, 10, MM_NOGRP | NO_MINVENT);
    const trap = addTrap(level, TELEP_TRAP, 11, 10);
    newsym(11, 10);

    await teleportMonsterFromTrap(monster, trap);
    await flush_screen(1);

    assert.equal(trap.tseen, true);
    assert.notEqual(`${monster.mx},${monster.my}`, '11,10');
    assert.equal(requireScreenCell(10, 11).ch, '^');
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'trap');
});

void test('an unseen monster teleport leaves its trap concealed', async () => {
    const level = freshObjectRoom();
    const monster = await createMonsterAt('newt', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.minvis = true;
    const trap = addTrap(level, TELEP_TRAP, 11, 10);
    newsym(11, 10);

    await teleportMonsterFromTrap(monster, trap);
    await flush_screen(1);

    assert.equal(trap.tseen, false);
    assert.equal(requireScreenCell(10, 11).ch, '.');
});
