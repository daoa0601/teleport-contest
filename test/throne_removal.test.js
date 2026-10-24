import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, THRONE, T_LOOTED } from '../js/const.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a vanishing throne leaves ordinary ground without its looted flag', async () => {
    const level = freshObjectRoom({ gameplaySeed: 2n });
    const throne = level.requireAt(10, 10);
    throne.typ = THRONE;
    throne.looted = T_LOOTED;
    await runExtendedCommand('sit', ' '.repeat(10));
    assert.equal(throne.typ, ROOM);
    assert.equal(throne.looted, 0);
});
//# sourceMappingURL=throne_removal.test.js.map