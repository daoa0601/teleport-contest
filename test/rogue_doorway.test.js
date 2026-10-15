import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DOOR, D_NODOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
for (const direction of ['entry', 'exit']) {
    void test(`a doorless Rogue doorway rejects diagonal ${direction} without spending a turn`, async () => {
        const level = freshObjectRoom();
        level.flags.is_rogue_level = true;
        const door = direction === 'entry' ? level.requireAt(11, 9) : level.requireAt(10, 10);
        door.typ = DOOR;
        door.doormask = D_NODOOR;
        await rhack('u'.charCodeAt(0));
        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.equal(game.context.move, 0);
    });
}
void test('a doorless Rogue doorway permits orthogonal movement', async () => {
    const level = freshObjectRoom();
    level.flags.is_rogue_level = true;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_NODOOR;
    await rhack('l'.charCodeAt(0));
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=rogue_doorway.test.js.map