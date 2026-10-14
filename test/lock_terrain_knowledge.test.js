import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DOOR, D_CLOSED, D_ISOPEN, ROOM, STONE, VWALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('opening toward unseen terrain does not teach its type', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 10 } });
    const target = level.requireAt(11, 10);
    target.typ = ROOM;
    target.lastseentyp = STONE;
    game.blind = true;
    vision_recalc(0);
    pushKeys('l');
    await rhack('o'.charCodeAt(0));
    assert.equal(target.lastseentyp, STONE);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You feel no door there.');
});
void test('opening a door defers sight behind it until the vision boundary', async () => {
    const level = freshObjectRoom({ hero: { acurr: { a: [25, 25, 25, 25, 25, 25] } } });
    for (let y = 6; y <= 14; y++)
        level.requireAt(11, y).typ = VWALL;
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);
    pushKeys('l');
    await rhack('o'.charCodeAt(0));
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(cansee(12, 10), false);
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);
});
//# sourceMappingURL=lock_terrain_knowledge.test.js.map