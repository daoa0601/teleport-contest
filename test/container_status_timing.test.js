import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { ROCK, SACK } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { nearCapacity } from '../js/weight.js';
function statusRow() {
    return requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '';
}
// C pickup.c use_container() closes with update_inventory(), never bot().
// Taking a burdening stack out of a floor container reports the lift
// through pickup's prinv() prefix, and the status line keeps the old
// capacity until encumber_msg() later marks it dirty.
void test('a burdening take-out leaves the old capacity on the status line', async () => {
    await freshObjectRoom();
    const sack = await floorObject(SACK, 10, 10, {
        olocked: false, otrapped: false, initialize: false,
    });
    sack.contents ??= [];
    const rocks = await knownObject(ROCK, {
        invlet: 'b', where: 'contained', container: sack, quantity: 90,
    });
    sack.contents = [rocks];
    await flush_screen(1);
    const before = statusRow();
    assert.doesNotMatch(before, /Burdened/);
    const input = resetInputState();
    input.feed('loot\noa\n ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.inventory.includes(rocks), true);
    assert.equal(nearCapacity(game), 1, 'the carried rocks must burden the hero');
    assert.match(game._pending_message ?? game._retained_message ?? '', /little trouble removing b - 90 uncursed rocks/);
    assert.doesNotMatch(statusRow(), /Burdened/, 'use_container() must not repaint the status line itself');
});
//# sourceMappingURL=container_status_timing.test.js.map