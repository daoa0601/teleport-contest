import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, W_AMUL, W_ARMG, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { attackMonsterWithMonster, runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, LEATHER_GLOVES, STATUE } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function givePetrifyingWeapon(monster) {
    await equipMonsterObject(monster, await knownObject(LEATHER_GLOVES), W_ARMG);
    return await equipMonsterObject(monster, await untimedCorpse(MONSTER_NAME.indexOf('cockatrice')), W_WEP);
}
function freshMonsterFight() {
    freshObjectRoom({
        heroX: 18, left: 10, right: 20, top: 10, bottom: 10,
        flags: { verbose: false },
    });
    requirePlayingGame(game);
}
void test('a corpse weapon starts petrification without also dealing the initial hit damage', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    goblin.mpeaceful = false;
    await givePetrifyingWeapon(goblin);
    const health = game.u.uhp;
    pushKeys('                    ');
    await runMonsterAction(goblin, game, () => 0, count => count, () => 1);
    assert.equal(game.u.stonedTurns, 5);
    assert.equal(game.u.stoneKiller, 'goblin');
    assert.equal(game.u.uhp, health);
});
void test('a corpse weapon leaves the defeated monster and its equipment in a statue', async () => {
    freshMonsterFight();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    initializePet(soldier, { state: game });
    await givePetrifyingWeapon(soldier);
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    const dagger = await equipMonsterObject(giant, await knownObject(DAGGER), W_WEP);
    pushKeys(' '.repeat(40));
    await runMonsterAction(soldier, game, () => 0, count => count, () => 1);
    assert.notEqual(monsterAtPosition(game.level, giant.mx, giant.my), giant);
    const statue = floorObjectsAt(game.level, 11, 10).find(object => object.otyp === STATUE);
    assert.ok(statue, 'the petrified giant should leave a statue');
    assert.equal(statue.corpsenm, giant.mnum);
    assert.ok(statue.contents?.includes(dagger));
    assert.equal(dagger.owornmask, 0);
});
for (const gloves of [false, true]) {
    void test(`an unarmed monster ${gloves ? 'wearing gloves survives' : 'without gloves petrifies from'} touching a cockatrice`, async () => {
        freshMonsterFight();
        requirePlayingGame(game);
        const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
        initializePet(soldier, { state: game });
        if (gloves)
            await equipMonsterObject(soldier, await knownObject(LEATHER_GLOVES), W_ARMG);
        const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
        cockatrice.mpeaceful = false;
        cockatrice.movement = 0;
        const health = cockatrice.mhp;
        pushKeys(' '.repeat(40));
        await attackMonsterWithMonster(soldier, cockatrice, {
            state: game, random: () => 0, rollDice: count => count, rollOne: () => 1,
        });
        assert.equal(monsterAtPosition(game.level, soldier.mx, soldier.my) === soldier, gloves);
        if (gloves)
            assert.ok(cockatrice.mhp < health);
        else
            assert.equal(cockatrice.mhp, health);
    });
}
for (const protection of ['lizard corpse', 'life-saving amulet']) {
    void test(`a ${protection} saves the defender from a corpse weapon without extra hit damage`, async () => {
        freshMonsterFight();
        requirePlayingGame(game);
        const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
        initializePet(soldier, { state: game });
        await givePetrifyingWeapon(soldier);
        const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        orc.mpeaceful = false;
        const lifeSaving = protection === 'life-saving amulet';
        const item = await equipMonsterObject(orc, lifeSaving
            ? await knownObject(AMULET_OF_LIFE_SAVING)
            : await untimedCorpse(MONSTER_NAME.indexOf('lizard')), lifeSaving ? W_AMUL : 0);
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
void test('life saving protects an attacker without passing its interrupted hit to the defender', async () => {
    freshMonsterFight();
    requirePlayingGame(game);
    const soldier = await createMonsterAt('soldier', 10, 10, NO_MINVENT);
    initializePet(soldier, { state: game });
    const amulet = await equipMonsterObject(soldier, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    cockatrice.mpeaceful = false;
    const health = cockatrice.mhp;
    pushKeys(' '.repeat(40));
    await attackMonsterWithMonster(soldier, cockatrice, {
        state: game, random: () => 0, rollDice: count => count, rollOne: () => 1,
    });
    assert.ok(game.level.monsters.includes(soldier));
    assert.equal(soldier.mhp, soldier.mhpmax);
    assert.equal(soldier.minvent.includes(amulet), false);
    assert.equal(cockatrice.mhp, health);
});
for (const form of ['flesh golem', 'stone golem']) {
    void test(`a corpse weapon cannot petrify a hero in ${form} form`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        installPolymorphedHero(form);
        const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
        goblin.mpeaceful = false;
        await givePetrifyingWeapon(goblin);
        pushKeys(' '.repeat(40));
        await runMonsterAction(goblin, game, () => 0, count => count, () => 1);
        assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
        assert.equal(game.u.stonedTurns ?? 0, 0);
        assert.ok(game.u.mh < game.u.mhmax, 'the corpse should still deal physical damage');
    });
}
for (const cancelled of [false, true]) {
    void test(`a ${cancelled ? 'cancelled' : 'normal'} cockatrice ${cancelled ? 'only bites' : 'petrifies'} another monster`, async () => {
        freshMonsterFight();
        requirePlayingGame(game);
        const cockatrice = await createMonsterAt('cockatrice', 10, 10, NO_MINVENT);
        initializePet(cockatrice, { state: game });
        cockatrice.mcan = cancelled;
        const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        orc.mpeaceful = false;
        const health = orc.mhp;
        pushKeys(' '.repeat(40));
        await runMonsterAction(cockatrice, game, () => 0, count => count, () => 1);
        assert.equal(monsterAtPosition(game.level, orc.mx, orc.my) === orc, cancelled);
        if (cancelled)
            assert.ok(orc.mhp < health);
        else
            assert.ok(floorObjectsAt(game.level, 11, 10)
                .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
    });
}
void test('a corpse weapon turns a flesh golem defender into a living stone golem', async () => {
    freshMonsterFight();
    requirePlayingGame(game);
    const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
    initializePet(captain, { state: game });
    await givePetrifyingWeapon(captain);
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
//# sourceMappingURL=monster_stoning_combat.test.js.map