import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_AMUL, W_ARMG, W_WEP } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, LEATHER_GLOVES, STATUE } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function givePetrifyingWeapon(monster) {
    equipMonsterObject(monster, knownObject(LEATHER_GLOVES), W_ARMG);
    return equipMonsterObject(monster,
        untimedCorpse(MONSTER_NAME.indexOf('cockatrice')), W_WEP);
}

function freshMonsterFight() {
    freshObjectRoom({
        heroX: 18, left: 10, right: 20, top: 10, bottom: 10,
        flags: { verbose: false },
    });
}

test('a corpse weapon starts petrification without also dealing the initial hit damage', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    givePetrifyingWeapon(goblin);
    const health = game.u.uhp;
    pushKeys('                    ');

    await runMonsterAction(goblin, game, () => 0, count => count, () => 1);

    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoneKiller, 'goblin');
    assert.equal(game.u.uhp, health);
});

test('a corpse weapon leaves the defeated monster and its equipment in a statue', async () => {
    freshMonsterFight();
    const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    tameMonster(soldier, game);
    givePetrifyingWeapon(soldier);
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    const dagger = equipMonsterObject(giant, knownObject(DAGGER), W_WEP);
    pushKeys(' '.repeat(40));

    await runMonsterAction(soldier, game, () => 0, count => count, () => 1);

    assert.equal(game.level.monsters.includes(giant), false);
    const statue = game.level.objects[11][10].find(object => object.otyp === STATUE);
    assert.ok(statue, 'the petrified giant should leave a statue');
    assert.equal(statue.corpsenm, giant.mnum);
    assert.ok(statue.contents.includes(dagger));
    assert.equal(dagger.owornmask, 0);
});

for (const gloves of [false, true]) {
    test(`an unarmed monster ${gloves ? 'wearing gloves survives' : 'without gloves petrifies from'} touching a cockatrice`, async () => {
        freshMonsterFight();
        const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
        tameMonster(soldier, game);
        if (gloves) equipMonsterObject(soldier, knownObject(LEATHER_GLOVES), W_ARMG);
        const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
        cockatrice.mpeaceful = false;
        cockatrice.movement = 0;
        const health = cockatrice.mhp;
        pushKeys(' '.repeat(40));

        await runMonsterAction(soldier, game, () => 0, count => count, () => 1);

        assert.equal(game.level.monsters.includes(soldier), gloves);
        if (gloves) assert.ok(cockatrice.mhp < health);
        else assert.equal(cockatrice.mhp, health);
    });
}

for (const protection of ['lizard corpse', 'life-saving amulet']) {
    test(`a ${protection} saves the defender from a corpse weapon without extra hit damage`, async () => {
        freshMonsterFight();
        const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
        tameMonster(soldier, game);
        givePetrifyingWeapon(soldier);
        const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        orc.mpeaceful = false;
        const lifeSaving = protection === 'life-saving amulet';
        const item = equipMonsterObject(orc, lifeSaving
            ? knownObject(AMULET_OF_LIFE_SAVING)
            : untimedCorpse(MONSTER_NAME.indexOf('lizard')), lifeSaving ? W_AMUL : 0);
        const health = orc.mhp;
        pushKeys(' '.repeat(40));

        await runMonsterAction(soldier, game, () => 0, count => count, () => 1);

        assert.ok(game.level.monsters.includes(orc));
        assert.equal(orc.mhp, lifeSaving ? orc.mhpmax : health);
        assert.equal(orc.minvent.includes(item), false);
        assert.equal(floorObjectsAt(game.level, 11, 10)
            .some(object => object.otyp === STATUE), false);
    });
}

test('life saving protects an attacker without passing its interrupted hit to the defender', async () => {
    freshMonsterFight();
    const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    tameMonster(soldier, game);
    const amulet = equipMonsterObject(soldier, knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    cockatrice.mpeaceful = false;
    const health = cockatrice.mhp;
    pushKeys(' '.repeat(40));

    await runMonsterAction(soldier, game, () => 0, count => count, () => 1);

    assert.ok(game.level.monsters.includes(soldier));
    assert.equal(soldier.mhp, soldier.mhpmax);
    assert.equal(soldier.minvent.includes(amulet), false);
    assert.equal(cockatrice.mhp, health);
});

for (const form of ['flesh golem', 'stone golem']) {
    test(`a corpse weapon cannot petrify a hero in ${form} form`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        installPolymorphedHero(form);
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        goblin.mpeaceful = false;
        givePetrifyingWeapon(goblin);
        pushKeys(' '.repeat(40));

        await runMonsterAction(goblin, game, () => 0, count => count, () => 1);

        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
        assert.equal(game.u.stonedTurns ?? 0, 0);
        assert.ok(game.u.mh < game.u.mhmax, 'the corpse should still deal physical damage');
    });
}

for (const cancelled of [false, true]) {
    test(`a ${cancelled ? 'cancelled' : 'normal'} cockatrice ${cancelled ? 'only bites' : 'petrifies'} another monster`, async () => {
        freshMonsterFight();
        const cockatrice = await createMonsterAt('cockatrice', 10, 10, NO_MINVENT);
        tameMonster(cockatrice, game);
        cockatrice.mcan = cancelled;
        const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        orc.mpeaceful = false;
        const health = orc.mhp;
        pushKeys(' '.repeat(40));

        await runMonsterAction(cockatrice, game, () => 0, count => count, () => 1);

        assert.equal(game.level.monsters.includes(orc), cancelled);
        if (cancelled) assert.ok(orc.mhp < health);
        else assert.ok(floorObjectsAt(game.level, 11, 10)
            .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
    });
}

test('a corpse weapon turns a flesh golem defender into a living stone golem', async () => {
    freshMonsterFight();
    const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
    tameMonster(captain, game);
    givePetrifyingWeapon(captain);
    const golem = await createMonsterAt('flesh golem', 11, 10, NO_MINVENT);
    golem.mpeaceful = false;
    pushKeys(' '.repeat(40));

    await runMonsterAction(captain, game, () => 0, count => count, () => 1);

    assert.ok(game.level.monsters.includes(golem));
    assert.equal(golem.mnum, MONSTER_NAME.indexOf('stone golem'));
    assert.ok(golem.mhp < golem.mhpmax);
    assert.equal(floorObjectsAt(game.level, 11, 10)
        .some(object => object.otyp === STATUE), false);
});
