import assert from 'node:assert/strict';
import test from 'node:test';
import { TER_DETECT, TER_MAP } from '../js/const.js';
import { getposHelpUntilDismissed } from '../js/getpos.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
async function helpText(goal) {
    const input = resetInputState();
    const help = getposHelpUntilDismissed(goal);
    await input.waitUntilBlocked();
    try {
        return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    }
    finally {
        input.feed(' ');
        await help;
    }
}
void test('position help uses rebound movement and target keys', async () => {
    freshObjectRoom({ flags: { tips: false } });
    assert.equal(game.commandBindings.bindKey(104, 'nothing').accepted, true);
    assert.equal(game.commandBindings.bindKey(115, 'movewest').accepted, true);
    assert.equal(game.commandBindings.bindSpecialKey(113, 'getpos.mon.next'), true);
    const text = await helpText('a location');
    assert.match(text, /Use 's', 'j', 'k', 'l' to move/);
    assert.match(text, /Use 'q'\/'M' to move the cursor to next\/previous monster/);
});
void test('position help describes the active menu, area filter, and fast-move modes', async () => {
    freshObjectRoom({ iflags: { getloc_usemenu: true, getloc_filter: 2, getloc_moveskip: true } });
    const text = await helpText('a location');
    assert.match(text, /fast-move the cursor, skipping same glyphs/);
    assert.match(text, /get a menu of monsters in this area/);
    assert.match(text, /get a menu of locations next to unexplored locations in area/);
    assert.match(text, /change fast-move mode to 8 units at a time/);
});
void test('monster-only position help omits the unrelated target controls', async () => {
    freshObjectRoom();
    const text = await helpText('a monster');
    assert.match(text, /next\/previous monster/);
    assert.doesNotMatch(text, /next\/previous object|automatic description|change fast-move mode/);
});
void test('terrain detection help includes only the applicable controls', async () => {
    freshObjectRoom({ iflags: { terrainmode: TER_MAP | TER_DETECT } });
    const text = await helpText('anything of interest');
    assert.match(text, /next\/previous door/);
    assert.doesNotMatch(text, /next\/previous monster|next\/previous object|automatic description|menu listing/);
});
//# sourceMappingURL=getpos_help.test.js.map