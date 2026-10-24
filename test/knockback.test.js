import { monsterAtPosition } from '../js/monster_location.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { D_CLOSED, D_ISOPEN, D_NODOOR, DOOR, HOLE, LAVAPOOL, NO_MINVENT, PIT, W_AMUL, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, CLUB, CORPSE, DAGGER, LOADSTONE, STATUE } from '../js/object_data.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { runExtendedCommand } from './support/commands.js';
import { installPagerInput } from './support/pager-input.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { finishHeroMonsterKillOutcome } from '../js/hero_monster_death.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { freshObjectRoom } from './support/object-room.js';
async function freshGiantFight() {
    freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
    requireFixtureGame(game);
    const giant = await createMonsterAt('hill giant', 10, 10, NO_MINVENT);
    initializePet(giant, { state: game });
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    orc.mpeaceful = false;
    return { giant, orc };
}
for (const weapon of [null, CLUB, DAGGER]) {
    const attack = weapon === CLUB ? 'a club' : weapon === DAGGER ? 'a dagger' : 'its fist';
    void test(`a giant using ${attack} ${weapon === DAGGER ? 'cuts its opponent without knockback' : 'knocks its opponent back'}`, async () => {
        const { giant, orc } = await freshGiantFight();
        requireFixtureGame(game);
        if (weapon !== null)
            await equipMonsterObject(giant, await knownObject(weapon), W_WEP);
        const health = orc.mhp;
        pushKeys(' '.repeat(40));
        await runMonsterAction(giant, game, () => 0, count => count, () => 1);
        assert.equal(orc.mx, weapon === DAGGER ? 11 : 13);
        if (weapon === DAGGER)
            assert.ok(orc.mhp < health);
        else {
            assert.equal(orc.mhp, health, 'C returns after monster knockback without applying the pending hit damage');
            assert.equal(orc.mstun, 1);
            assert.equal(orc.movement, 0);
        }
    });
}
void test('a knocked monster passes over one pit and falls into the pit where it lands', async () => {
    const { giant, orc } = await freshGiantFight();
    requireFixtureGame(game);
    orc.mhp = orc.mhpmax = 100;
    addTrap(game.level, PIT, 12, 10);
    addTrap(game.level, PIT, 13, 10);
    pushKeys(' '.repeat(40));
    await runMonsterAction(giant, game, () => 0, count => count, () => 1);
    assert.equal(orc.mx, 13);
    assert.equal(orc.mtrapped, 1);
    assert.ok(orc.mhp > 0 && orc.mhp < 100, 'the landing pit damages its surviving occupant');
});
void test('a knocked flying monster lands above a hole without revealing it', async () => {
    freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
    requireFixtureGame(game);
    const giant = await createMonsterAt('hill giant', 10, 10, NO_MINVENT);
    initializePet(giant, { state: game });
    const bat = await createMonsterAt('giant bat', 11, 10, NO_MINVENT);
    bat.mpeaceful = false;
    bat.mhp = bat.mhpmax = 100;
    const hole = addTrap(game.level, HOLE, 13, 10);
    pushKeys(' '.repeat(40));
    await runMonsterAction(giant, game, () => 0, count => count, () => 1);
    assert.equal(bat.mx, 13, 'the bat is knocked two squares');
    assert.ok(game.level.monsters.includes(bat));
    assert.equal(hole.tseen, false, "C's landing mintrap(FORCEBUNGLE) leaves fliers above floor traps");
});
void test('a knocked monster petrifies when it collides with a cockatrice', async () => {
    const { giant, orc } = await freshGiantFight();
    requireFixtureGame(game);
    await createMonsterAt('cockatrice', 12, 10, NO_MINVENT);
    pushKeys(' '.repeat(40));
    await runMonsterAction(giant, game, () => 0, count => count, () => 1);
    assert.notEqual(monsterAtPosition(game.level, orc.mx, orc.my), orc);
    assert.ok(floorObjectsAt(game.level, 11, 10)
        .some(object => object.otyp === STATUE && object.corpsenm === orc.mnum));
});
for (const loadstone of [false, true]) {
    void test(`a small hero ${loadstone ? 'carrying a loadstone stands firm' : 'is knocked back'} when hit by a giant`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requireFixtureGame(game);
        installPolymorphedHero('kobold');
        if (loadstone)
            await addInventoryObject(LOADSTONE);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        giant.mpeaceful = false;
        pushKeys(' '.repeat(40));
        await runMonsterAction(giant, game, () => 0, count => count, () => 1);
        assert.equal(game.u.ux, loadstone ? 10 : 8);
        assert.ok(game.u.mh < game.u.mhmax, 'hero knockback must not cancel the hit damage');
    });
}
void test('a cursed saddle makes the mount and rider move together when struck', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 }, flags: { verbose: false } });
    requireFixtureGame(game);
    const pony = await createSaddledSteed('pony');
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    assert.ok(pony.saddle);
    pony.saddle.cursed = true;
    const titan = await createMonsterAt('titan', 10, 10, NO_MINVENT);
    pushKeys(' '.repeat(40));
    await tryKnockback(titan, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, { random: () => 0 });
    assert.equal(game.u.usteed, pony);
    assert.equal(game.u.ux, 13);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});
void test('a blow aimed toward an occupied square says back and leaves the hero in place', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('kobold');
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    await createMonsterAt('kitten', 9, 10, NO_MINVENT);
    const messages = [];
    pushKeys(' '.repeat(8));
    const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
        publish: message => { messages.push(message); },
    });
    assert.equal(result.knocked, true);
    assert.equal(result.moved, false);
    assert.equal(game.u.ux, 10);
    assert.equal(messages[0], 'The hill giant knocks you back with a powerful strike!');
});
void test('a boulder behind the hero does not prevent a knockback blow', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('kobold');
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    await floorObject(BOULDER, 9, 10);
    const messages = [];
    pushKeys(' '.repeat(8));
    // hack.c test_move(TEST_MOVE) assumes a boulder can be pushed.
    const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
        publish: message => { messages.push(message); },
    });
    assert.equal(result.knocked, true);
    assert.match(messages[0] ?? '', /^The hill giant knocks you back/);
});
void test('a monster landing in a lethal pit survives through its worn life-saving amulet', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const defender = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    defender.mhp = 1;
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    addTrap(game.level, PIT, 12, 10);
    installPagerInput(resetInputState(), {
        expected: /pit|medallion|looks much better|crumbles to dust/i, limit: 8,
    });
    const outcome = await hurtleMonster(defender, 1, 0, 1, {
        finishMonsterDeath: (target, options) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
            ...options, showKillMessage: false,
        }),
    });
    assert.equal(outcome.moved, true);
    assert.equal(outcome.dead, false);
    assert.equal(game.level.monsters.includes(defender), true);
    assert.ok(defender.mhp > 0);
    assert.equal(defender.mx, 12);
    assert.equal(defender.mtrapped, 1);
    assert.equal(amulet.where, 'gone');
    assert.equal(defender.minvent.includes(amulet), false);
});
void test('a lizard hurled into lava burns without leaving its otherwise guaranteed corpse', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const defender = await createMonsterAt('lizard', 11, 10, NO_MINVENT);
    game.level.requireAt(12, 10).typ = LAVAPOOL;
    installPagerInput(resetInputState(), {
        expected: /lizard|lava|burns/i, limit: 4,
    });
    const outcome = await hurtleMonster(defender, 1, 0, 1);
    assert.equal(outcome.dead, true);
    assert.notEqual(monsterAtPosition(game.level, defender.mx, defender.my), defender);
    assert.equal(floorObjectsAt(game.level, 12, 10)
        .some(object => object.otyp === CORPSE && object.corpsenm === defender.mnum), false);
});
for (const doorway of [false, true]) {
    void test(`a hero's blow ${doorway ? 'cannot knock a monster out of an open doorway' : 'knocks a small monster back along a corridor'}`, async () => {
        const level = freshObjectRoom({ heroX: 10, heroY: 10, right: 20 });
        requireFixtureGame(game);
        if (doorway) {
            const door = level.requireAt(11, 10);
            door.typ = DOOR;
            door.doormask = D_ISOPEN;
        }
        const rat = await createMonsterAt('sewer rat', 11, 10, NO_MINVENT);
        const result = await tryKnockback(game.u, rat, { attackType: AT_WEAP, damageType: AD_PHYS }, { random: () => 0, publish: async () => { } });
        assert.equal(result.knocked, !doorway);
        assert.equal(rat.mx === 11, doorway);
    });
}
for (const form of ['rock mole', 'kobold']) {
    void test(`a giant ${form === 'rock mole' ? 'knocks a rock-eating hero toward solid rock' : 'cannot knock a hero into solid rock'}`, async () => {
        freshObjectRoom({ left: 10 });
        requireFixtureGame(game);
        installPolymorphedHero(form);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        const messages = [];
        pushKeys(' '.repeat(8));
        // hack.c test_move(TEST_MOVE) lets a pickless tunneler eat the rock.
        const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
            random: () => 0,
            publish: message => { messages.push(message); },
        });
        assert.equal(result.knocked, form === 'rock mole');
        if (form === 'rock mole')
            assert.match(messages[0] ?? '', /^The hill giant knocks you back/);
        else
            assert.deepEqual(messages, []);
    });
}
void test('a giant knocks a rock-eating hero diagonally toward a closed door', async () => {
    const level = freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('rock mole');
    const door = level.requireAt(9, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const giant = await createMonsterAt('hill giant', 11, 11, NO_MINVENT);
    const messages = [];
    pushKeys(' '.repeat(8));
    // test_move() skips the doorway entry check when the door is eaten.
    const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
        publish: message => { messages.push(message); },
    });
    assert.equal(result.knocked, true);
    assert.match(messages[0] ?? '', /^The hill giant knocks you back/);
});
void test("a hero's blow cannot knock a monster out of a Rogue-level doorway", async () => {
    const level = freshObjectRoom({ heroX: 10, heroY: 10, right: 20 });
    level.flags.is_rogue_level = true;
    requireFixtureGame(game);
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_NODOOR;
    const rat = await createMonsterAt('sewer rat', 11, 10, NO_MINVENT);
    const result = await tryKnockback(game.u, rat, { attackType: AT_WEAP, damageType: AD_PHYS }, { random: () => 0, publish: async () => { } });
    assert.equal(result.knocked, false);
    assert.equal(rat.mx, 11);
    assert.equal(rat.my, 10);
});
//# sourceMappingURL=knockback.test.js.map