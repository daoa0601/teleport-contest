import test from 'node:test';
import assert from 'node:assert/strict';

import {
    readyRangedMonsterWeapon, selectRangedWeapon,
    throwMonsterWeaponAtMonster,
} from '../js/monster_throw.js';
import { NEED_WEAPON } from '../js/const.js';
import {
    ARROW, BOW, DAGGER, ELVEN_ARROW, ELVEN_BOW,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { quietMonsterActionRng } from '../js/monmove.js';
import { carriedObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import {
    addMonsterToLevel, liveMonster,
} from './support/monsters.js';
import {
    freshRangedCombatRoom, rangedPet, rangedTarget,
} from './support/ranged-combat.js';

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

test('a tame orc throws a dagger at a distant monster', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const dagger = carriedObject(DAGGER);
    const orc = addMonsterToLevel(rangedPet('orc', {
        inventory: [dagger],
    }));
    const target = addMonsterToLevel(rangedTarget());
    target.mhp = target.mhpmax = 1;

    quietMonsterActionRng(orc, game);

    assert.deepEqual([orc.mx, orc.my], [9, 10]);
    assert.equal(target.mhp, 0);
    assert.equal(orc.inventory.includes(dagger), false);
    assert.equal(
        floorObjectsAt(game.level, 12, 10).some(
            object => object.otyp === DAGGER,
        ),
        true,
    );
});

test('a tame orc shoots an arrow with its bow', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const arrow = carriedObject(ARROW);
    const bow = carriedObject(BOW, { wielded: true });
    const orc = addMonsterToLevel(rangedPet('orc', {
        inventory: [arrow, bow],
        mw: bow,
    }));
    const target = addMonsterToLevel(rangedTarget());

    quietMonsterActionRng(orc, game);

    assert.deepEqual([orc.mx, orc.my], [9, 10]);
    assert.ok(target.mhp < 12);
    assert.equal(orc.mw, bow);
    assert.equal(orc.inventory.includes(arrow), false);
    assert.equal(
        floorObjectsAt(game.level, 12, 10).some(
            object => object.otyp === ARROW,
        ),
        true,
    );
});

test('an elven lord fires every arrow in a three-shot volley', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const arrows = carriedObject(ELVEN_ARROW, { quan: 3 });
    const bow = carriedObject(ELVEN_BOW, { wielded: true });
    const archer = addMonsterToLevel(rangedPet('elf-noble', {
        inventory: [arrows, bow],
        mw: bow,
    }));
    const target = addMonsterToLevel(rangedTarget());
    target.mhp = target.mhpmax = 100;

    throwMonsterWeaponAtMonster(archer, target, game, {
        random: () => 1,
        rollOne: range => range,
    });

    const landedArrows = floorObjectsAt(game.level, 12, 10)
        .filter(object => object.otyp === ELVEN_ARROW)
        .reduce((total, object) => total + object.quan, 0);
    assert.equal(landedArrows, 3);
    assert.equal(archer.inventory.includes(arrows), false);
    assert.ok(target.mhp < 100);
});

test('an orc captain uses both of its weapon attacks', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = carriedObject(DAGGER, { quan: 2 });
    const captain = addMonsterToLevel(rangedPet('orc-captain', {
        inventory: [daggers],
    }));
    const target = addMonsterToLevel(rangedTarget());
    target.mhp = target.mhpmax = 100;

    quietMonsterActionRng(captain, game);

    const landedDaggers = floorObjectsAt(game.level, 12, 10)
        .filter(object => object.otyp === DAGGER)
        .reduce((total, object) => total + object.quan, 0);
    assert.equal(landedDaggers, 2);
    assert.equal(captain.inventory.includes(daggers), false);
    assert.ok(target.mhp < 100);
});
