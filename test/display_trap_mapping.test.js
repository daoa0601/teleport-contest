import assert from 'node:assert/strict';
import test from 'node:test';
import { PIT, WEB } from '../js/const.js';
import { premap_detect } from '../js/detect.js';
import { flush_screen, map_trap, see_traps, show_glyph_cell } from '../js/display.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('mapping a trap projects it without discovering the real trap', async () => {
    const level = await freshObjectRoom();
    const trap = addTrap(level, PIT, 11, 10, { tseen: false });
    await map_trap(trap);
    assert.equal(trap.tseen, false);
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'trap');
});
void test('premapping a level explicitly discovers its traps', async () => {
    const level = await freshObjectRoom();
    const trap = addTrap(level, PIT, 11, 10, { tseen: false });
    await premap_detect();
    assert.equal(trap.tseen, true);
});
void test('trap refresh preserves a temporary overlay above a remembered trap', async () => {
    const level = await freshObjectRoom();
    const trap = addTrap(level, PIT, 11, 10, { tseen: true });
    await map_trap(trap);
    await show_glyph_cell(11, 10, '*');
    await see_traps();
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '*');
});
void test('trap refresh updates a displayed trap on a level without map memory', async () => {
    const level = await freshObjectRoom();
    level.flags.hero_memory = false;
    const trap = addTrap(level, PIT, 11, 10, { tseen: true });
    await map_trap(trap);
    trap.ttyp = WEB;
    await see_traps();
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '"');
});
//# sourceMappingURL=display_trap_mapping.test.js.map