import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_CLOSED } from '../js/const.js';
import { ROCK } from '../js/object_data.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { objectAtMapDescription } from '../js/pager.js';
import { transientObjectGlyph } from '../js/display.js';
import { mksobj, placeCreatedObject } from '../js/mkobj.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoomLevel } from './support/playable-room.js';
// C pager.c:look_at_object() (pager.c:411-412) reads the described level's
// own square for the closed-door placement suffix.  Describing a level
// other than the hero's current one must not consult the current level's
// door state at the same coordinates.
void test('an object embedded in a closed door is described on its own level', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    const currentSquare = game.level.requireAt(10, 10);
    assert.notEqual(currentSquare.typ, DOOR, 'the current level must have no door at 10,10');
    const described = createRoomLevel();
    const door = described.requireAt(10, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const rock = await mksobj(ROCK, false, false);
    const describedState = { ...game, level: described };
    placeCreatedObject(rock, 10, 10, describedState);
    const text = await objectAtMapDescription(10, 10, transientObjectGlyph(rock), describedState);
    assert.match(text, /embedded in a door/);
});
//# sourceMappingURL=farlook_door_level.test.js.map