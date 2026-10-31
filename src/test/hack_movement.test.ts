import assert from 'node:assert/strict';
import test from 'node:test';
import { heroMoveBlockedBetween, heroTestMove, isValidTravelTarget } from '../js/hack.js';
import { D_CLOSED, D_ISOPEN, D_NODOOR, DOOR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C hack.c:test_move(): TEST_TRAV admits closed doors while TEST_MOVE
// rejects them; neither mode opens the door or moves the hero.
void test('a closed door can be on a travel route without admitting an ordinary step', async () => {
    const level = await freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10 });
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    assert.equal(heroTestMove(11, 10), false);
    assert.equal(await isValidTravelTarget(14, 10), true);

    assert.equal(door.doormask, D_CLOSED);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
});

// C hack.c:test_move(): diagonal exit restrictions use the supplied origin,
// including when bhit() tests a thrown iron ball away from the hero.
void test('a movement test uses the supplied doorway origin for a diagonal exit', async () => {
    const level = await freshObjectRoom();
    const door = level.requireAt(13, 10);
    door.typ = DOOR;
    door.doormask = D_ISOPEN;

    assert.equal(heroMoveBlockedBetween(13, 10, 14, 11), true);
    assert.equal(heroMoveBlockedBetween(13, 10, 14, 10), false);

    door.doormask = D_NODOOR;
    assert.equal(heroMoveBlockedBetween(13, 10, 14, 11), false);
});

// C hack.c:test_move(): TEST_MOVE assumes a boulder can be pushed, leaving
// moverock() and its object changes to the actual movement attempt.
void test('testing an ordinary step onto a boulder leaves it on its square', async () => {
    const level = await freshObjectRoom();
    const boulder = await floorObject(BOULDER, 11, 10);

    assert.equal(heroTestMove(11, 10), true);

    assert.equal(level.objects[11]?.[10]?.includes(boulder), true);
    assert.deepEqual([boulder.ox, boulder.oy], [11, 10]);
    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
});
