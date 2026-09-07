import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DOOR, D_CLOSED, D_NODOOR, I_SPECIAL, NO_MINVENT, NO_WEAPON_WANTED,
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SADDLE,
    W_WEP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
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
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('fire elementals have triple health on their home plane', async () => {
    const health = [];
    for (const home of [false, true]) {
        freshObjectRoom({ gameplaySeed: 29n });
        game.fire_level = home ? { ...game.u.uz } : { dnum: 7, dlevel: 3 };

        const monster = await createMonsterAt('fire elemental', 11, 10, NO_MINVENT);

        health.push(monster.mhpmax);
    }
    assert.equal(health[1], 3 * health[0]);
});

test('a long worm loses its old body when it changes form', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('long worm', 11, 10);
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(monster.wormno, 0);
    assert.deepEqual(monster.wormSegments, []);
});

test('a monster receives a worm body when it becomes a long worm', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('little dog', 11, 10);
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

    assert.ok(monster.wormno > 0);
    assert.ok(Array.isArray(monster.wormSegments));
});

test('a leashed monster pulls free when its new body cannot be leashed',
    async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('little dog', 11, 10);
        monster.mleashed = 1;
        const leash = addInventoryObject(LEASH, {
            leashmon: monster.m_id,
        });
        initRng(1n);

        changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

        assert.equal(monster.mleashed, 0);
        assert.equal(leash.leashmon, 0);
        assert.equal(game.inventory.includes(leash), true);
    });

test('a monster drops its weapon when its new form cannot wield one',
    async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('giant', 11, 10);
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

test('a large new body destroys ordinary torso clothing', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt(
        'shopkeeper', 11, 10, NO_MINVENT,
    );
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

test('a tiny new body drops gear that no longer fits', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt(
        'shopkeeper', 11, 10, NO_MINVENT,
    );
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

test('a former giant drops boulders its new form cannot carry', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('giant', 11, 10);
    const boulder = equipMonsterObject(monster, knownObject(BOULDER), 0);
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, monster.mx);
    assert.equal(boulder.oy, monster.my);
});

test('a monster drops its saddle when its new body cannot wear one',
    async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('pony', 11, 10);
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
    const monster = await createMonsterAt(263, 11, 10);
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
    const werejackal = await createMonsterAt(262, 11, 10);
    werejackal.minvis = 1;
    const sleeper = await createMonsterAt('jackal', 12, 10);
    sleeper.msleeping = 1;
    const messages = [];

    const change = wereChange(werejackal, game, () => 0);
    await presentWereChange(change, {
        publish: async message => messages.push(message),
        wakeNearby: wakeMonstersNear,
    });

    assert.deepEqual(messages, ['You hear a jackal howling at the moon.']);
    assert.equal(sleeper.msleeping, 0);
});

test('a wounded vampire shape returns to its natural form', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('fog cloud', 11, 10);
    Object.assign(monster, {
        mhp: 2,
        mhpmax: 20,
        cham: MONSTER_NAME.indexOf('vampire'),
    });
    initRng(1n);

    const change = decideMonsterShapeChange(monster, game, () => 1);

    assert.equal(monster.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(change.message, 'The fog cloud turns into a vampire!');
});

test('a killed vampire shape rises in its natural form', async () => {
    const level = freshObjectRoom();
    const vampire = MONSTER_NAME.indexOf('vampire');
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.cham = vampire;

    const removed = await finishHeroMonsterKill(
        monster, monster.mx, monster.my, { showKillMessage: false },
    );

    assert.equal(removed, false);
    assert.equal(monster.mnum, vampire);
    assert.equal(monster.mhp > 0, true);
    assert.equal(level.monsters.includes(monster), true);
});

test('a vampire becoming solid inside a closed door smashes it', async () => {
    const level = freshObjectRoom();
    const door = level.at(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const vampire = MONSTER_NAME.indexOf('vampire');
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.mhp = 0;
    monster.cham = vampire;
    const messages = [];

    const death = await finishEnvironmentalMonsterDeath(monster, game, {
        publish: async message => messages.push(message),
    });

    assert.equal(death.survived, true);
    assert.equal(monster.mnum, vampire);
    assert.equal(door.doormask, D_NODOOR);
    assert.ok(messages.some(message => message.includes('door is smashed')));
});
