import assert from 'node:assert/strict';
import test from 'node:test';
import { ARMOR_CLASS } from '../js/objclass.js';
import { LEATHER_GLOVES, SPEED_BOOTS } from '../js/object_data.js';
import { armorSimpleName, armorSlotFor } from '../js/do_wear.js';

// C obj.h is_shield()/is_helmet()/is_boots()/is_gloves()/is_cloak()/
// is_shirt()/is_suit() classify armor by objects[].oc_armcat behind the
// armor-class guard, so the generic armor marker row (otyp 3, ARM_SUIT) is a
// suit to C even though it is not one of the wearable armor ranges 89..172.
// do_wear.c's takeoff/naming dispatch reaches suit_simple_name() for it.
void test('armor slot classification follows oc_armcat, not the armor id ranges', () => {
    assert.equal(armorSlotFor(3), 'uarm');
    // The worn-slot nouns come from the category: a suit names itself by its
    // noun shape even when the type is the generic armor marker.
    assert.equal(armorSimpleName({ otyp: 3, oclass: ARMOR_CLASS }), 'suit');
    assert.equal(armorSlotFor(SPEED_BOOTS), 'uarmf');
    assert.equal(armorSlotFor(LEATHER_GLOVES), 'uarmg');
});

