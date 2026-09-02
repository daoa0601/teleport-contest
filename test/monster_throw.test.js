import test from 'node:test';
import assert from 'node:assert/strict';

import {
    readyRangedMonsterWeapon, selectRangedWeapon,
} from '../js/monster_throw.js';
import { NEED_WEAPON } from '../js/const.js';
import { ARROW, BOW } from '../js/object_data.js';
import { carriedObject } from './support/game-objects.js';
import { liveMonster } from './support/monsters.js';

test('a monster readies the launcher required by its ammunition', () => {
    const bow = carriedObject(BOW);
    const arrows = carriedObject(ARROW, { quan: 6 });
    const archer = liveMonster({
        species: 'orc',
        x: 10,
        y: 10,
        inventory: [arrows, bow],
        weaponCheck: NEED_WEAPON,
    });

    const readied = readyRangedMonsterWeapon(archer);

    assert.equal(readied, bow);
    assert.equal(archer.mw, bow);
    assert.equal(bow.wielded, true);
    assert.equal(selectRangedWeapon(archer), arrows);
});
