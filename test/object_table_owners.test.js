import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMOR_CLASS, WEAPON_CLASS, TOOL_CLASS } from '../js/objclass.js';
import { CROSSBOW, ELVEN_MITHRIL_COAT, ELVEN_LEATHER_HELM, SMALL_SHIELD, SPEAR, SPEED_BOOTS, OBJ_NAME } from '../js/object_data.js';
import { OBJ_DESCR } from '../js/o_init.js';
import { is_elven_armor, is_launcher, is_shield, is_spear } from '../js/object_properties.js';
// C obj.h is_launcher(): WEAPON_CLASS with oc_skill between P_BOW and
// P_CROSSBOW. Tools and ammunition never count.
void test('is_launcher accepts only weapon-class bows and crossbows', () => {
    assert.equal(is_launcher({ otyp: CROSSBOW, oclass: WEAPON_CLASS }), true);
    assert.equal(is_launcher({ otyp: CROSSBOW, oclass: TOOL_CLASS }), false);
    assert.equal(is_launcher({ otyp: SPEAR, oclass: WEAPON_CLASS }), false);
});
// C obj.h is_spear(): WEAPON_CLASS with oc_skill == P_SPEAR.
void test('is_spear requires the weapon class', () => {
    assert.equal(is_spear({ otyp: SPEAR, oclass: WEAPON_CLASS }), true);
    assert.equal(is_spear({ otyp: SPEAR, oclass: ARMOR_CLASS }), false);
});
// C obj.h is_elven_armor(): the five elven armor types, by otyp set only.
// Worn.c:racial_exception() lets hobbits wear exactly these.
void test('elven mithril coats and leather helms are elven armor', () => {
    assert.equal(is_elven_armor({ otyp: ELVEN_MITHRIL_COAT, oclass: ARMOR_CLASS }), true);
    assert.equal(is_elven_armor({ otyp: ELVEN_LEATHER_HELM, oclass: ARMOR_CLASS }), true);
    assert.equal(is_elven_armor({ otyp: SPEAR, oclass: WEAPON_CLASS }), false);
});
// C obj.h is_shield(): ARMOR_CLASS with oc_armcat == ARM_SHIELD. A
// weapon-class object never passes even when the port classifies it by slot.
void test('is_shield requires the armor class', () => {
    assert.equal(is_shield({ otyp: SMALL_SHIELD, oclass: ARMOR_CLASS }), true);
    assert.equal(is_shield({ otyp: SMALL_SHIELD, oclass: WEAPON_CLASS }), false);
});
void test('description readers use the current appearance while true names stay fixed', () => {
    const descriptions = [];
    descriptions[SPEED_BOOTS] = 'snow boots';
    assert.equal(OBJ_DESCR(SPEED_BOOTS, { objectDescriptions: descriptions }), 'snow boots');
    assert.equal(OBJ_NAME(SPEED_BOOTS), 'speed boots');
});
//# sourceMappingURL=object_table_owners.test.js.map