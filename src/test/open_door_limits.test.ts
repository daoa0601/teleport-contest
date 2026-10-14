import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DBWALL, DB_WEST, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_CLOSED, D_NODOOR, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CHEST } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a tiny hero with hands cannot pull a closed door open', async () => {
    const level = freshObjectRoom({ hero: { umonnum: MONSTER_NAME.indexOf('leprechaun'), mh: 20, mhmax: 20 } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    pushKeys('l');
    await rhack('o'.charCodeAt(0));
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(game._pending_message, "You're too small to pull the door open.");
    assert.equal(game.context.move, 1, 'the previously unseen closed door was learned');
});

for (const raised of [false, true]) {
    for (const wall of [false, true]) {
        void test(`opening at a ${raised ? 'raised' : 'lowered'} drawbridge ${wall ? 'wall' : 'span'} reports its state`, async () => {
            const level = freshObjectRoom();
            const span = level.requireAt(wall ? 12 : 11, 10);
            span.typ = raised ? DRAWBRIDGE_UP : DRAWBRIDGE_DOWN;
            span.drawbridgemask = DB_WEST;
            const gate = level.requireAt(wall ? 11 : 10, 10);
            gate.typ = raised ? DBWALL : DOOR;
            gate.doormask = D_NODOOR;
            pushKeys('l');
            await rhack('o'.charCodeAt(0));
            assert.equal(game._pending_message, raised ? 'There is no obvious way to open the drawbridge.' : 'The drawbridge is already open.');
        });
    }
}

void test('opening from a pit with a box offers the native floor directions', async () => {
    freshObjectRoom({ hero: { utrap: 3, utraptype: TT_PIT } });
    await floorObject(CHEST, 10, 10, { olocked: false, contents: [] });
    const input = resetInputState();
    await answerPrompts(rhack('o'.charCodeAt(0)), input, [{ prompt: /Open where\? \[\.>\]/, keys: '\x1b' }]);
    assert.equal(game.context.move, 0);
});
