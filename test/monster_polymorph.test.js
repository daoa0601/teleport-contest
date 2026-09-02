import test from 'node:test';
import assert from 'node:assert/strict';

import {
    I_SPECIAL, NO_WEAPON_WANTED, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH,
    W_ARMS, W_ARMU, W_SADDLE, W_WEP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { wakeMonstersNear } from '../js/monster_wake.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    changeMonsterForm, decideMonsterShapeChange,
} from '../js/monster_polymorph.js';
import {
    BOULDER, CHAIN_MAIL, DAGGER, ELVEN_CLOAK, HAWAIIAN_SHIRT, HELMET,
    LEASH, LEATHER_GLOVES, SADDLE, SMALL_SHIELD, SPEED_BOOTS,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { presentWereChange, wereChange } from '../js/were.js';
import { knownInventoryObject, knownObject } from './support/game-objects.js';
import { addMonster, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a long worm loses its old body when it changes form', () => {
    freshObjectRoom();
    const monster = addMonster({
        species: 'long worm',
        x: 11,
        y: 10,
        wormno: 1,
        wormSegments: [{ x: 10, y: 10 }, { x: 9, y: 10 }],
    });
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(monster.wormno, 0);
    assert.deepEqual(monster.wormSegments, []);
});

test('a monster receives a worm body when it becomes a long worm', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'little dog', x: 11, y: 10 });
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

    assert.ok(monster.wormno > 0);
    assert.ok(Array.isArray(monster.wormSegments));
});

test('a leashed monster pulls free when its new body cannot be leashed', () => {
    freshObjectRoom();
    const monster = addMonster({
        species: 'little dog', x: 11, y: 10, mleashed: 1,
    });
    const leash = knownInventoryObject(LEASH, { leashmon: monster.m_id });
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

    assert.equal(monster.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.inventory.includes(leash), true);
});

test('a monster drops its weapon when its new form cannot wield one', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'giant', x: 11, y: 10 });
    const dagger = equipMonsterObject(
        monster, knownObject(DAGGER), W_WEP,
    );
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(monster.mw, null);
    assert.equal(monster.weaponCheck, NO_WEAPON_WANTED);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.ox, monster.mx);
    assert.equal(dagger.oy, monster.my);
});

test('a large new body destroys ordinary torso clothing', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'shopkeeper', x: 11, y: 10 });
    const clothing = [
        equipMonsterObject(monster, knownObject(CHAIN_MAIL), W_ARM),
        equipMonsterObject(monster, knownObject(ELVEN_CLOAK), W_ARMC),
        equipMonsterObject(monster, knownObject(HAWAIIAN_SHIRT), W_ARMU),
    ];
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('giant'));

    for (const object of clothing)
        assert.equal(object.where, 'gone', `${object.name} should be destroyed`);
    assert.equal(monster.inventory.length, 0);
    assert.ok(monster.misc_worn_check & I_SPECIAL);
});

test('a tiny new body drops gear that no longer fits', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'shopkeeper', x: 11, y: 10 });
    const gear = [
        equipMonsterObject(monster, knownObject(CHAIN_MAIL), W_ARM),
        equipMonsterObject(monster, knownObject(ELVEN_CLOAK), W_ARMC),
        equipMonsterObject(monster, knownObject(HELMET), W_ARMH),
        equipMonsterObject(monster, knownObject(SMALL_SHIELD), W_ARMS),
        equipMonsterObject(monster, knownObject(LEATHER_GLOVES), W_ARMG),
        equipMonsterObject(monster, knownObject(SPEED_BOOTS), W_ARMF),
    ];
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('grid bug'));

    for (const object of gear)
        assert.equal(object.where, 'floor', `${object.name} should be dropped`);
    assert.equal(monster.inventory.length, 0);
});

test('a former giant drops boulders its new form cannot carry', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'giant', x: 11, y: 10 });
    const boulder = equipMonsterObject(monster, knownObject(BOULDER), 0);
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, monster.mx);
    assert.equal(boulder.oy, monster.my);
});

test('a monster drops its saddle when its new body cannot wear one', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'pony', x: 11, y: 10 });
    const saddle = equipMonsterObject(
        monster, knownObject(SADDLE), W_SADDLE,
    );
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('grid bug'));

    assert.equal(saddle.where, 'floor');
    assert.equal(monster.saddled, false);
});

test('a visible werewolf announces its natural change', async () => {
    freshObjectRoom();
    game.datetime = '20250101010000';
    game.flags.moonphase = 4;
    const monster = addMonster({ mnum: 263, x: 11, y: 10 });
    const messages = [];

    const change = wereChange(monster, game, () => 0);
    await presentWereChange(change, {
        publish: async message => messages.push(message),
        wakeNearby: wakeMonstersNear,
    });

    assert.equal(monster.mnum, 21);
    assert.deepEqual(messages, ['The werewolf changes into a wolf.']);
    assert.equal(game.were_changes, 1);
});

test('an unseen werejackal howls and wakes nearby monsters', async () => {
    freshObjectRoom();
    game.datetime = '20250101010000';
    game.flags.moonphase = 4;
    const werejackal = addMonster({
        mnum: 262, x: 11, y: 10, minvis: 1,
    });
    const sleeper = addMonster({
        species: 'jackal', x: 12, y: 10, msleeping: 1,
    });
    const messages = [];

    const change = wereChange(werejackal, game, () => 0);
    await presentWereChange(change, {
        publish: async message => messages.push(message),
        wakeNearby: wakeMonstersNear,
    });

    assert.deepEqual(messages, ['You hear a jackal howling at the moon.']);
    assert.equal(sleeper.msleeping, 0);
});

test('a wounded vampire shape returns to its natural form', () => {
    freshObjectRoom();
    const monster = addMonster({
        species: 'fog cloud',
        x: 11,
        y: 10,
        hitPoints: 2,
        maxHitPoints: 20,
        cham: MONSTER_NAME.indexOf('vampire'),
    });
    initRng(1n);

    const change = decideMonsterShapeChange(monster, game, () => 1);

    assert.equal(monster.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(change.message, 'The fog cloud turns into a vampire!');
});
