import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DBWALL, DB_WEST, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_NODOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { SKELETON_KEY } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const raised of [false, true]) {
    for (const wall of [false, true]) {
        void test(`applying a key at a ${raised ? 'raised' : 'lowered'} drawbridge ${wall ? 'portcullis' : 'span'} identifies the absent lock`, async () => {
            const level = freshObjectRoom();
            const span = level.requireAt(wall ? 12 : 11, 10);
            span.typ = raised ? DRAWBRIDGE_UP : DRAWBRIDGE_DOWN;
            span.drawbridgemask = DB_WEST;
            const gate = level.requireAt(wall ? 11 : 10, 10);
            gate.typ = raised ? DBWALL : DOOR;
            gate.doormask = D_NODOOR;
            await addInventoryObject(SKELETON_KEY, { invlet: 'a' });
            pushKeys('al');

            await rhack('a'.charCodeAt(0));

            const expected = wall
                ? raised ? 'You see no lock on the drawbridge.' : 'This doorway has no door.'
                : 'You see no door there.';
            assert.equal(game._pending_message, expected);
            assert.ok(!game._occupation);
        });
    }
}
