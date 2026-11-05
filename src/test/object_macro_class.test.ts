import assert from 'node:assert/strict';
import test from 'node:test';
import { RANDOM_CLASS } from '../js/objclass.js';
import { ARROW, PICK_AXE, TWO_HANDED_SWORD } from '../js/object_data.js';
import { isWeaponTool, isLauncherAmmunition, isBimanualObject } from '../js/object_properties.js';

// C obj.h tests the instance's stored oclass before reading its table row.
void test('weapon-tools require the stored tool class', () => {
    assert.equal(isWeaponTool({ otyp: PICK_AXE, oclass: RANDOM_CLASS }), false);
});

void test('ammunition requires a stored weapon or gem class', () => {
    assert.equal(isLauncherAmmunition({ otyp: ARROW, oclass: RANDOM_CLASS }), false);
});

void test('two-handed weapons require a stored weapon or tool class', () => {
    assert.equal(isBimanualObject({ otyp: TWO_HANDED_SWORD, oclass: RANDOM_CLASS }), false);
});
