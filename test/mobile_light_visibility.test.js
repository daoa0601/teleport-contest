import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { beginObjectBurn } from '../js/light.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { OIL_LAMP } from '../js/object_data.js';
import { cansee, hasLightSources, vision_recalc, vision_reset } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a buried luminous monster does not illuminate the floor but its carried lamp still does', async () => {
    const level = freshObjectRoom({ right: 24 });
    for (let x = 7; x <= 24; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const elemental = await createMonsterAt('fire elemental', 15, 10, NO_MINVENT);
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(16, 10), true);
    elemental.mburied = 1;
    vision_recalc(0);
    assert.equal(cansee(16, 10), false, 'get_mon_location() excludes a buried light source');
    assert.equal(hasLightSources(), true, 'The hidden source still exists');
    const lamp = await addObjectToMonsterInventory(elemental, await knownObject(OIL_LAMP, { age: 200 }));
    assert.ok(lamp);
    beginObjectBurn(lamp);
    vision_recalc(0);
    assert.equal(cansee(18, 10), true, 'get_obj_location() only requires a carrier on this level');
});
//# sourceMappingURL=mobile_light_visibility.test.js.map