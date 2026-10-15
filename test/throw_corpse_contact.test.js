import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { game } from '../js/gstate.js';
import { AMULET_OF_LIFE_SAVING, CORPSE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('throwing a cockatrice corpse bare-handed petrifies before releasing it', async () => {
    freshObjectRoom({ flags: { bones: false } });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    const corpse = await addInventoryObject(CORPSE, {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });
    await throwInventoryObject(corpse, 'l', ' '.repeat(20));
    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(corpse.where, 'floor', 'life saving lets the original throw continue');
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=throw_corpse_contact.test.js.map