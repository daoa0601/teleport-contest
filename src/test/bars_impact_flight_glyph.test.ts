import assert from 'node:assert/strict';
import test from 'node:test';
import { IRONBARS, NO_MINVENT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { inputGate } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { throwInventoryObject } from './support/commands.js';

// zap.c bhit() paints the missile with tmp_at(DISP_FLASH) on every square
// the flight passes (bhit:4087, flushed at display.c:1292) and keeps the
// effect open across the next square's impact handling. hits_bars() runs
// before that square is painted (bhit:3904), so hit_bars() plines
// ("Clonk!", then a sleeper waking nearby) leave the previous square's
// missile glyph on the terminal: tmp_at(DISP_END) after the loop only
// newsym()s it back (display.c:1241-1244), and nothing flushes before the
// message pager waits. A --More-- raised by the impact messages therefore
// shows the missile glyph, not the terrain beneath it.
function screenCell(x: number, y: number) {
    const cell = requireGameDisplay(game).grid[y + 1]?.[x - 1];
    assert.ok(cell, `Expected a displayed map cell at ${x},${y}`);
    return cell;
}

void test('a missile stopped by iron bars keeps its flight glyph through the impact --More--', async () => {
    const level = await freshObjectRoom();
    level.requireAt(12, 10).typ = IRONBARS;
    const sleepers = [];
    for (const x of [13, 14, 15]) {
        const sleeper = await createMonsterAt('goblin', x, 10, NO_MINVENT);
        sleeper.msleeping = 1;
        sleepers.push(sleeper);
    }
    const dagger = await addInventoryObject(DAGGER, { invlet: 'a' });

    const gate = inputGate();
    const thrown = throwInventoryObject(dagger, 'l');
    await gate.waitUntilBlocked();

    const screen = requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /Clonk.*--More--/, 'The bars impact must page: Clonk! then a waking sleeper');
    assert.equal(screenCell(11, 10).ch, ')',
        'bhit() painted the dagger on (11,10) before the bars square; the pager still shows it');

    gate.feed(' ');
    await thrown;
});
