import assert from 'node:assert/strict';
import test from 'node:test';

import { breathWeaponName } from '../js/breath_ray.js';
import { AD_SPC1, AD_SPC2 } from '../js/monster_attack_types.js';

for (const { damageType, name } of [
    { damageType: AD_SPC1, name: 'strange breath #8' },
    { damageType: AD_SPC2, name: 'strange breath #9' },
]) {
    void test(`reserved breath ${damageType} retains its numbered description`, () => {
        assert.equal(breathWeaponName(damageType), name);
    });
}

