import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory, removeHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { I_SPECIAL, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { removeHeroEquipment, removeWornHeroItem } from '../js/hero_equipment.js';
import { RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_SHOCK_RESISTANCE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C worn.c setworn()/setnotworn(): when an item whose oc_oprop is one of the
// nine remembered resistances leaves its equipment slot, every monster which
// can see the hero forgets that observation and may try the attack again.
void test('taking off worn resistance armor clears what watching monsters remember', async () => {
    freshObjectRoom();
    const watcher = await createMonsterAt('soldier', 12, 10);
    // (18,10) is rock outside the room, so this soldier cannot see the hero;
    // monstunseesu only clears the bit for monsters with line of sight.
    const blindSpot = await createMonsterAt('soldier', 18, 10);
    watcher.seen_resistance = M_SEEN_FIRE | M_SEEN_COLD;
    blindSpot.seen_resistance = M_SEEN_FIRE | M_SEEN_COLD;
    const mail = await addInventoryObject(RED_DRAGON_SCALE_MAIL);
    wearHeroArmor(mail);
    await removeWornHeroItem(mail);
    assert.equal(watcher.seen_resistance, M_SEEN_COLD);
    assert.equal(blindSpot.seen_resistance, M_SEEN_FIRE | M_SEEN_COLD);
});
void test('removing a resistance ring clears only that remembered resistance', async () => {
    freshObjectRoom();
    const watcher = await createMonsterAt('soldier', 12, 10);
    watcher.seen_resistance = M_SEEN_ELEC | M_SEEN_FIRE;
    const ring = await addInventoryObject(RIN_SHOCK_RESISTANCE);
    await wearHeroAccessory(ring, 'uleft');
    await removeHeroAccessory(ring);
    assert.equal(watcher.seen_resistance, M_SEEN_FIRE);
});
// Embedded dragon skin never passes through setworn()'s slot loop, so losing
// it must not notify anyone (C polyself.c handles it with pointer moves).
void test('embedded dragon skin leaving the hero keeps monster memories intact', async () => {
    freshObjectRoom();
    const watcher = await createMonsterAt('soldier', 12, 10);
    watcher.seen_resistance = M_SEEN_FIRE;
    const scales = await addInventoryObject(RED_DRAGON_SCALES);
    wearHeroArmor(scales);
    game.uarm = null;
    game.u.uarm = null;
    game.uskin = scales;
    scales.owornmask = (scales.owornmask ?? 0) | I_SPECIAL;
    await removeHeroEquipment(scales);
    assert.equal(watcher.seen_resistance, M_SEEN_FIRE);
});
//# sourceMappingURL=worn_resistance_memory.test.js.map