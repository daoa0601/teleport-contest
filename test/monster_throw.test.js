import test from 'node:test';
import assert from 'node:assert/strict';

import {
    continueMonsterWeaponVolley,
    finishDeferredRangedProjectileHit,
    finishHeroProjectileHit,
    presentMonsterProjectileShot,
    readyRangedMonsterWeapon, selectRangedWeapon,
    throwMonsterWeaponAtHero, throwMonsterWeaponAtMonster,
} from '../js/monster_throw.js';
import { NEED_WEAPON, W_AMUL } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import {
    AMULET_OF_LIFE_SAVING, ARROW, BOW, CROSSBOW, CROSSBOW_BOLT, DAGGER,
    ELVEN_ARROW, ELVEN_BOW,
} from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    beginMonsterRangedTurn, continueMonsterRangedTurn,
} from '../js/dogmove.js';
import {
    finishEnvironmentalMonsterDeath, quietMonsterActionRng,
} from '../js/monmove.js';
import {
    carriedObject, knownInventoryObject,
} from './support/game-objects.js';
import { wearHeroObject } from './support/hero-state.js';
import {
    floorObjectQuantityAt, floorObjectsAt,
} from './support/level-state.js';
import { addMonsterToLevel, liveMonster } from './support/monsters.js';
import {
    finishRangedAttacks, freshRangedCombatRoom,
    rangedMonster, rangedPet, rangedTarget,
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

    const action = quietMonsterActionRng(orc, game);
    finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });

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

    const action = quietMonsterActionRng(orc, game);
    finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });

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

test('a hostile monster can throw a dagger at the hero and land it', () => {
    freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
    const dagger = carriedObject(DAGGER);
    const orc = addMonsterToLevel(rangedMonster('orc', {
        inventory: [dagger],
    }));
    const hitPointsBefore = game.u.uhp;

    const attack = throwMonsterWeaponAtHero(orc, game, dagger, {
        random: () => 1,
        rollOne: () => 1,
    });
    const shot = attack.shots[0];

    assert.equal(shot.heroTarget, true);
    assert.equal(shot.hit, true);
    assert.equal(game.u.uhp, hitPointsBefore - 1);
    assert.equal(orc.inventory.includes(dagger), false);

    finishDeferredRangedProjectileHit(shot, game);

    assert.equal(
        floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(dagger),
        true,
    );
});

test('a hostile rogue throws its full dagger volley at the hero', () => {
    freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
    const daggers = carriedObject(DAGGER, { quan: 4 });
    const rogue = addMonsterToLevel(rangedMonster('rogue', {
        inventory: [daggers],
    }));
    const hitPointsBefore = game.u.uhp;
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 1,
        rollOne: () => rolls.shift(),
    };

    const attack = throwMonsterWeaponAtHero(
        rogue, game, daggers, options,
    );
    finishDeferredRangedProjectileHit(attack.shots[0], game, () => 0);
    while (continueMonsterWeaponVolley(attack, game, options)) {
        finishDeferredRangedProjectileHit(
            attack.shots.at(-1), game, () => 0,
        );
    }

    assert.equal(game.u.uhp, hitPointsBefore - 3);
    assert.equal(
        floorObjectQuantityAt(game.level, game.u.ux, game.u.uy, DAGGER),
        3,
    );
    assert.equal(daggers.quan, 1);
});

test('life saving lets a hostile monster finish its dagger volley', async () => {
    freshRangedCombatRoom({ heroX: 12, heroY: 10, gameplaySeed: 1n });
    game.nhDisplay = new GameDisplay(null);
    const amulet = wearHeroObject(
        knownInventoryObject(AMULET_OF_LIFE_SAVING),
        'uamul',
        W_AMUL,
    );
    game.u.uhp = 1;
    const daggers = carriedObject(DAGGER, { quan: 4 });
    const rogue = addMonsterToLevel(rangedMonster('rogue', {
        inventory: [daggers],
    }));
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 1,
        rollOne: () => rolls.shift(),
    };
    const attack = throwMonsterWeaponAtHero(
        rogue, game, daggers, options,
    );
    pushKeys(' '.repeat(12));

    await finishHeroProjectileHit(
        attack.shots[0], game, { random: () => 0 },
    );
    let nextShot;
    while ((nextShot = continueMonsterWeaponVolley(
        attack, game, options,
    ))) {
        await finishHeroProjectileHit(nextShot, game, { random: () => 0 });
    }

    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(
        floorObjectQuantityAt(game.level, game.u.ux, game.u.uy, DAGGER),
        3,
    );
});

test('a monster life-saves before the next dagger is thrown', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = carriedObject(DAGGER, { quan: 4 });
    const rogue = addMonsterToLevel(rangedPet('rogue', {
        inventory: [daggers],
    }));
    const amulet = carriedObject(AMULET_OF_LIFE_SAVING, {
        owornmask: W_AMUL,
        worn: true,
        where: 'minvent',
    });
    const target = addMonsterToLevel(rangedTarget('jackal', {
        hitPoints: 1,
        inventory: [amulet],
        misc_worn_check: W_AMUL,
    }));
    const rolls = [2, 1, 1, 1, 1, 1, 1];
    const options = {
        random: () => 0,
        rollOne: () => rolls.shift(),
    };

    const attack = throwMonsterWeaponAtMonster(
        rogue, target, game, options,
    );

    assert.equal(target.mhp, 0);
    assert.equal(daggers.quan, 3);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 0);

    await finishEnvironmentalMonsterDeath(target, game, {
        visible: false,
        publish: async () => {},
        random: () => 0,
    });
    finishDeferredRangedProjectileHit(attack.shots[0], game, () => 0);
    let shot;
    while ((shot = continueMonsterWeaponVolley(attack, game, options))) {
        finishDeferredRangedProjectileHit(shot, game, () => 0);
    }

    assert.equal(game.level.monsters.includes(target), true);
    assert.ok(target.mhp > 0);
    assert.equal(target.inventory.includes(amulet), false);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 3);
    assert.equal(daggers.quan, 1);
});

test('a missed intervening monster does not hide the later hit', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n, recalculateVision: true });
    game.nhDisplay = new GameDisplay(null);
    const dagger = carriedObject(DAGGER);
    const orc = addMonsterToLevel(rangedPet('orc', {
        inventory: [dagger],
    }));
    const bystander = addMonsterToLevel(rangedTarget('goblin', {
        x: 11,
        hitPoints: 12,
        mac: -10,
    }));
    const target = addMonsterToLevel(rangedTarget('jackal', {
        x: 13,
        hitPoints: 12,
    }));
    const rolls = [20, 1, 1];

    const attack = throwMonsterWeaponAtMonster(orc, target, game, {
        random: () => 1,
        rollOne: () => rolls.shift(),
    });
    const messages = [];
    await presentMonsterProjectileShot(
        attack.shots[0],
        { ch: ')', color: 0, decgfx: false, attr: 0 },
        game,
        { publish: async message => messages.push(message) },
    );

    assert.equal(bystander.mhp, 12);
    assert.equal(target.mhp, 11);
    assert.deepEqual(messages, [
        'The dagger misses the goblin.',
        'The dagger hits the jackal.',
    ]);
});

test('a crossbow bolt gets its source damage against a large monster', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const bolt = carriedObject(CROSSBOW_BOLT);
    const crossbow = carriedObject(CROSSBOW, { wielded: true });
    const orc = addMonsterToLevel(rangedPet('orc', {
        inventory: [bolt, crossbow],
        mw: crossbow,
    }));
    const target = addMonsterToLevel(rangedTarget('purple worm', {
        hitPoints: 100,
        mac: 100,
    }));

    const options = {
        random: () => 0,
        rollOne: range => range,
    };
    const attack = throwMonsterWeaponAtMonster(
        orc, target, game, options,
    );
    finishRangedAttacks([attack], game, options);

    assert.equal(target.mhp, 93);
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

    const options = {
        random: () => 0,
        rollOne: range => range,
    };
    const attack = throwMonsterWeaponAtMonster(
        archer, target, game, options,
    );
    finishRangedAttacks([attack], game, options);

    assert.equal(floorObjectQuantityAt(game.level, 12, 10, ELVEN_ARROW), 3);
    assert.equal(archer.inventory.includes(arrows), false);
    assert.ok(target.mhp < 100);
});

test('a rogue player monster gets its dagger volley bonus', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = carriedObject(DAGGER, { quan: 4 });
    const rogue = addMonsterToLevel(rangedPet('rogue', {
        inventory: [daggers],
    }));
    const target = addMonsterToLevel(rangedTarget('jackal', {
        hitPoints: 100,
    }));

    const options = {
        random: () => 0,
        rollOne: range => range,
    };
    const attack = throwMonsterWeaponAtMonster(
        rogue, target, game, options,
    );
    finishRangedAttacks([attack], game, options);

    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 3);
    assert.equal(daggers.quan, 1);
});

test('a second weapon attack starts after the first dagger lands', () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const daggers = carriedObject(DAGGER, { quan: 2 });
    const captain = addMonsterToLevel(rangedPet('orc-captain', {
        inventory: [daggers],
    }));
    const target = addMonsterToLevel(rangedTarget('jackal', {
        hitPoints: 100,
    }));
    const options = { random: () => 0, rollOne: () => 1 };

    const turn = beginMonsterRangedTurn(captain, target, game, options);
    const firstAttack = turn.current.attack;

    assert.equal(daggers.quan, 1);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 0);

    finishRangedAttacks([firstAttack], game, options);
    const hitPointsAfterFirstAttack = target.mhp;
    const secondAttack = continueMonsterRangedTurn(
        turn, game, options,
    ).attack;

    assert.ok(target.mhp < hitPointsAfterFirstAttack);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 1);

    finishRangedAttacks([secondAttack], game, options);

    assert.equal(captain.inventory.includes(daggers), false);
    assert.equal(floorObjectQuantityAt(game.level, 12, 10, DAGGER), 2);
});
