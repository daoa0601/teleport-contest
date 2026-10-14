import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DBWALL, DB_WEST, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_CLOSED, D_ISOPEN } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { couldsee, vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a weak hero spends a turn against a resisting open door', async () => {
    const level = freshObjectRoom({ hero: { acurr: { a: [3, 3, 3, 3, 3, 3] } } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;
    initRng(1n);
    pushKeys('l');
    await rhack('c'.charCodeAt(0));
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(game._pending_message, 'The door resists!');
    assert.equal(game.context.move, 1);
});
for (const obstruction of ['object', 'monster']) {
    void test(`closing refuses a doorway occupied by an ${obstruction}`, async () => {
        const level = freshObjectRoom();
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_ISOPEN;
        if (obstruction === 'object')
            await floorObject(ROCK, 11, 10);
        else
            await createMonsterAt('xorn', 11, 10);
        newsym(11, 10);
        pushKeys('l');
        await rhack('c'.charCodeAt(0));
        assert.equal(door.doormask, D_ISOPEN);
        assert.match(game._pending_message, obstruction === 'object' ? /Something's in the way\./ : /blocks the way!/);
        assert.equal(game.context.move, 0);
    });
}
void test('a tiny hero with hands cannot close a door', async () => {
    const form = MONSTER_NAME.indexOf('leprechaun');
    const level = freshObjectRoom({ hero: { umonnum: form, mh: 20, mhmax: 20 } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;
    pushKeys('l');
    await rhack('c'.charCodeAt(0));
    assert.equal(door.doormask, D_ISOPEN);
    assert.equal(game._pending_message, "You're too small to push the door closed.");
    assert.equal(game.context.move, 0);
});
void test('closing a door blocks sight behind it', async () => {
    const level = freshObjectRoom({ hero: { acurr: { a: [25, 25, 25, 25, 25, 25] } } });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;
    vision_recalc(0);
    pushKeys('l');
    await rhack('c'.charCodeAt(0));
    vision_recalc(0);
    assert.equal(door.doormask, D_CLOSED);
    assert.equal(couldsee(12, 10), false);
});
for (const raised of [false, true]) {
    for (const wall of [false, true]) {
        void test(`closing at a ${raised ? 'raised' : 'lowered'} drawbridge ${wall ? 'wall' : 'span'} reports its state`, async () => {
            const level = freshObjectRoom();
            const span = level.requireAt(wall ? 12 : 11, 10);
            span.typ = raised ? DRAWBRIDGE_UP : DRAWBRIDGE_DOWN;
            span.drawbridgemask = DB_WEST;
            const gate = level.requireAt(wall ? 11 : 10, 10);
            gate.typ = raised ? DBWALL : DOOR;
            gate.doormask = 0;
            pushKeys('l');
            await rhack('c'.charCodeAt(0));
            assert.equal(game._pending_message, raised ? 'The drawbridge is already closed.' : 'There is no obvious way to close the drawbridge.');
            assert.equal(game.context.move, 0);
        });
    }
}
//# sourceMappingURL=close_door_effort.test.js.map