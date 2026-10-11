import assert from 'node:assert/strict';
import test from 'node:test';
import { G_EXTINCT, LANDMINE, MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, STONE, W_AMUL, W_ARM, W_WEP, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { tryMonsterPuddingSplit } from '../js/monster_pudding_split.js';
import { unwieldMonsterWeapon } from '../js/monster_weapon.js';
import { AMULET_OF_LIFE_SAVING, CLUB, DAGGER, GOLD_PIECE, LEATHER_ARMOR, OBJECT_NAMES, ROCK, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function puddingFight(species = 'black pudding', weaponType = DAGGER) {
    const level = freshObjectRoom({ gameplaySeed: 47n, context: { mon_moving: true } });
    requirePlayingGame(game);
    const aggressor = await createMonsterAt('goblin', 11, 11, BIRTH_FLAGS);
    const defender = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
    aggressor.mhp = aggressor.mhpmax = 50;
    defender.mhp = 21;
    defender.mhpmax = 80;
    aggressor.mpeaceful = defender.mpeaceful = false;
    const weapon = await equipMonsterObject(aggressor, await knownObject(weaponType), W_WEP);
    const messages = [];
    const options = {
        state: game,
        visible: true,
        publish: async (message) => { messages.push(message); },
    };
    return { level, aggressor, defender, weapon, messages, options };
}
for (const species of ['black pudding', 'brown pudding']) {
    void test(`a monster's iron contact splits a ${species} without duplicating possessions`, async () => {
        const { level, aggressor, defender, weapon, messages, options } = await puddingFight(species);
        const gold = await knownObject(GOLD_PIECE, { quan: 31 });
        await addObjectToMonsterInventory(defender, gold);
        const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, options);
        const clone = level.monsters.find(monster => monster !== defender && monster.mnum === defender.mnum);
        assert.equal(result.split, true);
        assert.equal(result.heroDied, false);
        assert.equal(result.aggressorDied, false);
        assert.ok(clone);
        assert.equal(defender.mhp, 11);
        assert.equal(clone.mhp, 10);
        assert.equal(defender.mhpmax, 80);
        assert.equal(clone.mhpmax, 80);
        assert.notEqual(clone.m_id, defender.m_id);
        assert.ok(defender.minvent.includes(gold));
        assert.equal(gold.ocarry, defender);
        assert.equal(clone.minvent?.length, 0);
        assert.equal(weapon.ocarry, aggressor);
        assert.match(messages.join('\n'), /divides as the goblin hits it!/);
    });
}
for (const weaponName of ['scalpel', 'dart']) {
    void test(`a monster's ${weaponName} contact can split a pudding`, async () => {
        const { aggressor, defender, weapon, options } = await puddingFight('black pudding', OBJECT_NAMES.indexOf(weaponName));
        const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, options);
        assert.equal(result.split, true);
        assert.equal(defender.mhp, 11);
    });
}
void test('the saved contact weapon still divides a pudding after being unwielded', async () => {
    const { aggressor, defender, weapon, options } = await puddingFight();
    await unwieldMonsterWeapon(aggressor);
    const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, options);
    assert.equal(aggressor.mw, null);
    assert.equal(weapon.wielded, false);
    assert.equal(result.split, true);
});
for (const guard of ['no weapon', 'wood', 'cancelled defender', 'one hit point', 'dead defender', 'other pudding', 'extinct']) {
    void test(`${guard} prevents monster-contact division`, async () => {
        const { level, aggressor, defender, weapon, options } = await puddingFight(guard === 'other pudding' ? 'gray ooze' : 'black pudding', guard === 'wood' ? CLUB : DAGGER);
        if (guard === 'cancelled defender')
            defender.mcan = 1;
        if (guard === 'one hit point')
            defender.mhp = 1;
        if (guard === 'dead defender')
            defender.mhp = 0;
        if (guard === 'extinct')
            requireMonsterVital(defender.mnum).mvflags |= G_EXTINCT;
        const hitPoints = defender.mhp;
        const result = await tryMonsterPuddingSplit(aggressor, defender, guard === 'no weapon' ? null : weapon, options);
        assert.equal(result.split, false);
        assert.equal(defender.mhp, hitPoints);
        assert.equal(level.monsters.filter(monster => monster.mnum === defender.mnum).length, 1);
    });
}
void test('attacker cancellation does not stop a physical weapon from dividing the target', async () => {
    const { aggressor, defender, weapon, options } = await puddingFight();
    aggressor.mcan = 1;
    assert.equal((await tryMonsterPuddingSplit(aggressor, defender, weapon, options)).split, true);
});
for (const hiddenBy of ['unseen fight', 'invisible defender']) {
    void test(`an ${hiddenBy} division has no identifying combat message`, async () => {
        const { aggressor, defender, weapon, options, messages } = await puddingFight();
        if (hiddenBy === 'invisible defender')
            defender.minvis = 1;
        const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, {
            ...options, visible: hiddenBy !== 'unseen fight',
        });
        assert.equal(result.split, true);
        assert.equal(messages.length, 0);
    });
}
void test('a life-saved pudding still divides after the lethal contact has finished', async () => {
    const { level, aggressor, defender, weapon, options } = await puddingFight();
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    installPagerInput(resetInputState(), { expected: /pudding|medallion|But wait/, limit: 5 });
    defender.mhp = 0;
    const death = await finishMonsterKilled(defender, game, { damageType: AD_PHYS, publish: options.publish });
    assert.equal(death.survived, true);
    const restoredHealth = defender.mhp;
    const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, options);
    const puddings = level.monsters.filter(monster => monster.mnum === defender.mnum);
    assert.equal(result.split, true);
    assert.equal(amulet.where, 'gone');
    assert.equal(puddings.length, 2);
    assert.equal(puddings.reduce((total, monster) => total + monster.mhp, 0), restoredHealth);
});
function leaveOnlyEasternCloneSquare(level) {
    for (let x = 10; x <= 12; x++) {
        for (let y = 9; y <= 11; y++) {
            if (y === 10 || (x === 11 && y === 11))
                continue;
            level.requireAt(x, y).typ = STONE;
        }
    }
}
void test('the new pudding immediately falls into a pit and can die without killing its parent', async () => {
    const { level, aggressor, defender, weapon, options } = await puddingFight();
    defender.mhp = 2;
    leaveOnlyEasternCloneSquare(level);
    addTrap(level, PIT, 12, 10);
    const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, options);
    assert.equal(result.split, true);
    assert.equal(result.aggressorDied, false);
    assert.equal(result.heroDied, false);
    assert.equal(defender.mhp, 1);
    assert.equal(level.monsters.filter(monster => monster.mnum === defender.mnum).length, 1);
    assert.equal(requireMonsterVital(defender.mnum).died, 1);
});
for (const lifeSaved of [false, true]) {
    void test(`a clone-triggered mine ${lifeSaved ? 'can life-save' : 'can kill'} the original aggressor with scattered debris`, async () => {
        const { level, aggressor, defender, weapon, options } = await puddingFight();
        defender.mhp = 201;
        defender.mhpmax = 250;
        aggressor.mhp = 1;
        // Bad armor makes this exposed one-hit-point attacker vulnerable
        // to the scattered rock regardless of its ordinary to-hit roll.
        await equipMonsterObject(aggressor, await knownObject(LEATHER_ARMOR, { spe: -30 }), W_ARM);
        const amulet = lifeSaved
            ? await equipMonsterObject(aggressor, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL)
            : null;
        leaveOnlyEasternCloneSquare(level);
        addTrap(level, LANDMINE, 12, 10);
        await floorObject(ROCK, 12, 10);
        installPagerInput(resetInputState(), { expected: /goblin|medallion|But wait/, limit: 5 });
        initRng(83n);
        // The highest scatter direction sends the rock southwest toward
        // the aggressor; the same high draw lets the heavy clone trip the mine.
        const result = await tryMonsterPuddingSplit(aggressor, defender, weapon, {
            ...options, random: range => Math.max(0, range - 1),
        });
        assert.equal(result.split, true);
        assert.equal(result.heroDied, false);
        assert.equal(result.aggressorDied, !lifeSaved);
        assert.equal(level.monsters.includes(aggressor), lifeSaved);
        assert.equal(defender.mhp, 101);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(aggressor.mhp > 0);
        }
        else
            assert.equal(aggressor.mhp, 0);
    });
}
//# sourceMappingURL=monster_pudding_split.test.js.map