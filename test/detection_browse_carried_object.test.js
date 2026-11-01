import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { detectObjects } from '../js/magic_detection.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { SPE_DETECT_TREASURE } from '../js/object_data.js';
import { corpseObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// C detect.c:object_detect() draws a monster-carried object at its carrier's
// square, and the browse's getpos autodescribe names it through
// do_screen_description() -> look_at(): with no matching floor object, a
// temporary mksobj() corpse supplies the description (its species taken from
// the remembered glyph) exactly as for any remembered object.
void test('the object detection browse names a monster-carried corpse from its glyph species', async () => {
    await freshObjectRoom({ flags: { tips: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const carrier = await createMonsterAt('kitten', 12, 10);
    await addObjectToMonsterInventory(carrier, await corpseObject(MONSTER_NAME.indexOf('lichen')));
    const action = detectObjects(await uninitializedObject(SPE_DETECT_TREASURE));
    const topl = () => requireScreenRow(0).map(cell => cell.ch).join('').trim();
    try {
        await input.waitUntilBlocked();
        input.feed('l');
        await input.waitUntilBlocked();
        input.feed('l');
        await input.waitUntilBlocked();
        assert.match(topl(), /a lichen corpse/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
//# sourceMappingURL=detection_browse_carried_object.test.js.map