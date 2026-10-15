import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { A_WIS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('learning the life-saving amulet does not train Wisdom above its exercise limit', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game._knownObjectTypes?.delete(AMULET_OF_LIFE_SAVING);
    game.u._exercise = [0, 0, 50, 0, 0, 0];
    initRng(4n);
    resetInputState().feed(' '.repeat(12));
    assert.equal(await loseHeroHp(100, 'falling rock'), false);
    assert.equal(game.u._exercise[A_WIS], 50);
    assert.equal(game._knownObjectTypes?.has(AMULET_OF_LIFE_SAVING), true);
});
//# sourceMappingURL=end_lifesaving_exercise.test.js.map