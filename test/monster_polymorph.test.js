import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_CLOSED, D_NODOOR, I_SPECIAL, LAVAPOOL, NO_MINVENT, NO_WEAPON_WANTED, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SADDLE, W_WEP, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { wakeMonstersNear } from '../js/monster_wake.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { changeMonsterForm, decideMonsterShapeChange, } from '../js/monster_polymorph.js';
import { BOULDER, CHAIN_MAIL, CLUB, DAGGER, ELVEN_CLOAK, HAWAIIAN_SHIRT, HELMET, LEASH, LEATHER_GLOVES, SADDLE, SMALL_SHIELD, SPEED_BOOTS, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { presentWereChange, wereChange } from '../js/were.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an endgame adventurer loses the rank in its name when polymorphed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.astral_level = { dnum: 9, dlevel: 5, flags: { town: false }, alignment: null };
    game.u.uz = { dnum: 9, dlevel: 1 };
    const adventurer = await createMonsterAt('archeologist', 11, 10, NO_MINVENT);
    setMonsterGivenName(adventurer, 'Aria the Investigator');
    await changeMonsterForm(adventurer, MONSTER_NAME.indexOf('little dog'), game);
    assert.equal(adventurer.name, 'Aria');
});
void test('random monster polymorph selects a species rather than a generic giant placeholder', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 11, 10, NO_MINVENT);
    initRng(418n);
    const change = await changeMonsterForm(monster, null, game);
    assert.ok(change);
    assert.notEqual(monster.mnum, MONSTER_NAME.indexOf('giant'));
});
void test('fire elementals have triple health on their home plane', async () => {
    const health = [];
    for (const home of [false, true]) {
        freshObjectRoom({ gameplaySeed: 29n });
        requirePlayingGame(game);
        game.fire_level = { ...(home ? game.u.uz : { dnum: 7, dlevel: 3 }),
            flags: { town: false }, alignment: null };
        const monster = await createMonsterAt('fire elemental', 11, 10, NO_MINVENT);
        health.push(monster.mhpmax);
    }
    assert.ok(health[0] !== undefined);
    assert.equal(health[1], 3 * health[0]);
});
void test('a long worm loses its old body when it changes form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('long worm', 11, 10);
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    assert.equal(monster.wormno, 0);
    assert.deepEqual(monster.wormSegments, []);
});
void test('a monster receives a worm body when it becomes a long worm', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('little dog', 11, 10);
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));
    assert.ok((monster.wormno ?? 0) > 0);
    assert.ok(Array.isArray(monster.wormSegments));
});
void test('a leashed monster pulls free when its new body cannot be leashed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('little dog', 11, 10);
    monster.mleashed = 1;
    const leash = await addInventoryObject(LEASH, {
        leashmon: monster.m_id,
    });
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));
    assert.equal(monster.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.inventory.includes(leash), true);
});
void test('a monster drops its weapon when its new form cannot wield one', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('giant', 11, 10);
    const dagger = await equipMonsterObject(monster, await knownObject(DAGGER), W_WEP);
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    assert.equal(monster.mw, null);
    assert.equal(monster.weaponCheck, NO_WEAPON_WANTED);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.ox, monster.mx);
    assert.equal(dagger.oy, monster.my);
});
void test('a wooden weapon burns when a new monster body drops it into lava', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    const club = await equipMonsterObject(monster, await knownObject(CLUB), W_WEP);
    level.requireAt(11, 10).typ = LAVAPOOL;
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('fire elemental'), game, {
        publish: async () => { },
    });
    assert.equal(monster.mw, null);
    assert.equal(monster.minvent.includes(club), false);
    assert.equal(club.where, 'gone');
    assert.equal(level.objects[11]?.[10]?.includes(club) ?? false, false);
});
void test('a large new body destroys ordinary torso clothing', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('shopkeeper', 11, 10, NO_MINVENT);
    const clothing = [
        await equipMonsterObject(monster, await knownObject(CHAIN_MAIL), W_ARM),
        await equipMonsterObject(monster, await knownObject(ELVEN_CLOAK), W_ARMC),
        await equipMonsterObject(monster, await knownObject(HAWAIIAN_SHIRT), W_ARMU),
    ];
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('giant'), game, {
        publish: async () => { },
    });
    for (const object of clothing)
        assert.equal(object.where, 'gone', `${object.name} should be destroyed`);
    assert.equal(monster.inventory.length, 0);
    assert.ok((monster.misc_worn_check ?? 0) & I_SPECIAL);
});
void test('a tiny new body drops gear that no longer fits', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('shopkeeper', 11, 10, NO_MINVENT);
    const gear = [
        await equipMonsterObject(monster, await knownObject(CHAIN_MAIL), W_ARM),
        await equipMonsterObject(monster, await knownObject(ELVEN_CLOAK), W_ARMC),
        await equipMonsterObject(monster, await knownObject(HELMET), W_ARMH),
        await equipMonsterObject(monster, await knownObject(SMALL_SHIELD), W_ARMS),
        await equipMonsterObject(monster, await knownObject(LEATHER_GLOVES), W_ARMG),
        await equipMonsterObject(monster, await knownObject(SPEED_BOOTS), W_ARMF),
    ];
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('grid bug'), game, {
        publish: async () => { },
    });
    for (const object of gear)
        assert.equal(object.where, 'floor', `${object.name} should be dropped`);
    assert.equal(monster.inventory.length, 0);
});
void test('a former giant drops boulders its new form cannot carry', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('giant', 11, 10);
    const boulder = await equipMonsterObject(monster, await knownObject(BOULDER), 0);
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, monster.mx);
    assert.equal(boulder.oy, monster.my);
});
void test('a monster drops its saddle when its new body cannot wear one', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('pony', 11, 10);
    const saddle = await equipMonsterObject(monster, await knownObject(SADDLE), W_SADDLE);
    initRng(1n);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('grid bug'));
    assert.equal(saddle.where, 'floor');
    assert.equal(monster.saddled, false);
});
void test('a visible werewolf announces its natural change', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.datetime = '20250101010000';
    game.flags.moonphase = 4;
    const monster = await createMonsterAt(263, 11, 10);
    const messages = [];
    const change = await wereChange(monster, game, () => 0, {
        publish: async (message) => messages.push(message),
    });
    await presentWereChange(change, {
        publish: async (message) => messages.push(message),
        wakeNearby: wakeMonstersNear,
    });
    assert.equal(monster.mnum, 21);
    assert.deepEqual(messages, ['The werewolf changes into a wolf.']);
    assert.equal(game.were_changes, 1);
});
void test('an unseen werejackal howls and wakes nearby monsters', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.datetime = '20250101010000';
    game.flags.moonphase = 4;
    const werejackal = await createMonsterAt(262, 11, 10);
    werejackal.minvis = 1;
    const sleeper = await createMonsterAt('jackal', 12, 10);
    sleeper.msleeping = 1;
    const messages = [];
    const change = await wereChange(werejackal, game, () => 0);
    await presentWereChange(change, {
        publish: async (message) => messages.push(message),
        wakeNearby: wakeMonstersNear,
    });
    assert.deepEqual(messages, ['You hear a jackal howling at the moon.']);
    assert.equal(sleeper.msleeping, 0);
});
void test('a wounded vampire shape returns to its natural form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.mhp = 2;
    monster.mhpmax = 20;
    monster.cham = MONSTER_NAME.indexOf('vampire');
    initRng(1n);
    const change = await decideMonsterShapeChange(monster, game, () => 1);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('vampire'));
    assert.equal(change?.message, 'The fog cloud turns into a vampire!');
});
void test('a killed vampire shape rises in its natural form', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const vampire = MONSTER_NAME.indexOf('vampire');
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.cham = vampire;
    const removed = await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
    assert.equal(removed, false);
    assert.equal(monster.mnum, vampire);
    assert.equal(monster.mhp > 0, true);
    assert.equal(level.monsters.includes(monster), true);
});
void test('a vampire becoming solid inside a closed door smashes it', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const vampire = MONSTER_NAME.indexOf('vampire');
    const monster = await createMonsterAt('fog cloud', 11, 10);
    monster.mhp = 0;
    monster.cham = vampire;
    const messages = [];
    const death = await finishEnvironmentalMonsterDeath(monster, game, {
        publish: async (message) => messages.push(message),
    });
    assert.equal(death.survived, true);
    assert.equal(monster.mnum, vampire);
    assert.equal(door.doormask, D_NODOOR);
    assert.ok(messages.some(message => message.includes('door is smashed')));
});
//# sourceMappingURL=monster_polymorph.test.js.map