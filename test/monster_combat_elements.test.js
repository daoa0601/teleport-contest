import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { M_ATTK_DEF_DIED, MM_NOGRP, MSLOW, NO_MINVENT, STRAT_HEAL, STRAT_WAITFORU, W_ARM, W_ARMC, W_WEP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_ACID, AD_COLD, AD_CORR, AD_DCAY, AD_ELEC, AD_FIRE, AD_RUST, AT_TUCH } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CHAIN_MAIL, CLOAK_OF_PROTECTION, CORPSE, DAGGER, LEATHER_ARMOR, OIL_LAMP, POT_HEALING, POT_OIL, SCR_BLANK_PAPER, WAN_FIRE, } from '../js/object_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [label, type, expectedDamage] of [
    ['fire', AD_FIRE, 0], ['cold', AD_COLD, 0], ['electricity', AD_ELEC, 0], ['acid', AD_ACID, 0],
    ['rust', AD_RUST, 8], ['corrosion', AD_CORR, 8], ['decay', AD_DCAY, 8],
]) {
    void test(`cancelled ${label} contact preserves its native damage rule`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
        attacker.mcan = 1;
        defender.mhp = defender.mhpmax = 80;
        defender.mstrategy = STRAT_WAITFORU;
        const armor = await knownObject(CHAIN_MAIL);
        await equipMonsterObject(defender, armor, W_ARM);
        const messages = [];
        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 8], {
            visible: true, rollDice: (count, sides) => count * sides,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(result.damage, expectedDamage);
        assert.equal(defender.mhp, 80 - expectedDamage);
        assert.equal(defender.mstrategy, STRAT_WAITFORU);
        assert.equal(armor.oeroded ?? 0, 0);
        assert.equal(armor.oeroded2 ?? 0, 0);
        assert.equal(messages.length, 0);
    });
}
void test('magic-cancelling armor blocks fire before it damages or ignites inventory', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('fire ant', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const cloak = await knownObject(CLOAK_OF_PROTECTION);
    await equipMonsterObject(defender, cloak, W_ARMC);
    const lamp = await knownObject(OIL_LAMP, { age: 500 });
    await addObjectToMonsterInventory(defender, lamp);
    const messages = [];
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_FIRE, 1, 8], {
        visible: true, random: () => 0, rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(defender.mhp, 80);
    assert.equal(!!lamp.lamplit, false);
    assert.equal(lamp.where, 'minvent');
    assert.deepEqual(messages, ['The orc avoids harm.']);
});
for (const [species, type, expectedHp, slow] of [
    ['iron golem', AD_FIRE, 22, false], ['flesh golem', AD_ELEC, 12, false],
    ['flesh golem', AD_COLD, 10, true], ['iron golem', AD_ELEC, 10, true],
]) {
    void test(`${species} reacts to elemental ${type} through its golem body`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        const defender = await createMonsterAt(species, 13, 10, MM_NOGRP | NO_MINVENT);
        defender.mhp = 10;
        defender.mhpmax = 80;
        const messages = [];
        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 12], {
            visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
            publish: async (message) => { messages.push(message); },
        });
        assert.equal(result.damage, 0);
        assert.equal(defender.mhp, expectedHp);
        if (slow)
            assert.equal(defender.mspeed, MSLOW);
        else
            assert.ok(messages.some(message => message.endsWith('seems healthier.')));
    });
}
for (const [label, species, type, objectType, extraDamage] of [
    ['cold potion', 'winter wolf', AD_COLD, POT_HEALING, 4],
    ['burning potion', 'hell hound', AD_FIRE, POT_HEALING, 6],
    ['burning scroll', 'hell hound', AD_FIRE, SCR_BLANK_PAPER, 0],
    ['exploding wand', 'energy vortex', AD_ELEC, WAN_FIRE, 0],
]) {
    void test(`resistance keeps the native ${label} inventory damage rule`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        const defender = await createMonsterAt(species, 13, 10, MM_NOGRP | NO_MINVENT);
        defender.mhp = defender.mhpmax = 80;
        const object = await knownObject(objectType, { quan: 2 });
        await addObjectToMonsterInventory(defender, object);
        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 20], {
            visible: true, random: () => 0, rollDice: (count, sides) => count * sides, rollOne: sides => sides,
            publish: async () => { },
        });
        assert.equal(object.where, 'gone');
        assert.equal(defender.minvent.includes(object), false);
        assert.equal(object.ocarry, null);
        assert.equal(object.carrierMid, undefined);
        assert.equal(result.damage, extraDamage);
        assert.equal(defender.mhp, 80 - extraDamage);
    });
}
void test('fire contact lights a surviving carried lamp and starts its burn timer', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('fire ant', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const lamp = await knownObject(OIL_LAMP, { age: 500 });
    await addObjectToMonsterInventory(defender, lamp);
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_FIRE, 1, 8], {
        visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
        publish: async () => { },
    });
    assert.equal(defender.mhp, 72);
    assert.equal(lamp.lamplit, true);
    assert.ok(objectTimers(lamp).some(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT));
});
void test('destroying a burning carried potion clears its carrier and burn timer', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('fire ant', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 100;
    const oil = await knownObject(POT_OIL, { age: 500 });
    await addObjectToMonsterInventory(defender, oil);
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_FIRE, 1, 8], {
        visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
        publish: async () => { },
    });
    assert.equal(oil.lamplit, true);
    assert.ok(objectTimers(oil).some(timer => timer.kind === OBJECT_TIMER_KIND.BURN_OBJECT));
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_FIRE, 1, 20], {
        visible: true, random: () => 0, rollDice: (count, sides) => count * sides,
        publish: async () => { },
    });
    assert.equal(oil.where, 'gone');
    assert.equal(oil.ocarry, null);
    assert.equal(oil.carrierMid, undefined);
    assert.equal(oil.lamplit, false);
    assert.equal(objectTimers(oil).length, 0);
    assert.equal(defender.minvent.includes(oil), false);
});
void test('a partly shattered potion stack keeps its carrier and loses carried weight', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('winter wolf', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('winter wolf', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const potions = await knownObject(POT_HEALING, { quan: 60 });
    await addObjectToMonsterInventory(defender, potions);
    const weight = potions.owt;
    initRng(73n);
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_COLD, 1, 20], {
        visible: true, rollDice: (count, sides) => count * sides, publish: async () => { },
    });
    assert.ok(potions.quan > 0 && potions.quan < 60);
    assert.ok(potions.owt > 0 && potions.owt < weight);
    assert.equal(potions.where, 'minvent');
    assert.equal(potions.ocarry === defender, true);
    assert.equal(potions.carrierMid, defender.m_id);
    assert.equal(defender.minvent.includes(potions), true);
});
for (const [species, type] of [
    ['paper golem', AD_FIRE], ['straw golem', AD_FIRE], ['iron golem', AD_RUST],
    ['wood golem', AD_DCAY], ['leather golem', AD_DCAY],
]) {
    void test(`${species} is destroyed directly by its elemental weakness and grants monster growth`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const attacker = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        attacker.m_lev = 1;
        attacker.mhp = attacker.mhpmax = 1;
        const defender = await createMonsterAt(species, 13, 10, MM_NOGRP | NO_MINVENT);
        defender.mhp = defender.mhpmax = 200;
        const heroExperience = game.u.uexp;
        const messages = [];
        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 1], {
            visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides, rollOne: sides => sides,
            publish: async (message) => { messages.push(message); },
        });
        assert.ok(result.nativeResult & M_ATTK_DEF_DIED);
        assert.notEqual(monsterAtPosition(game.level, defender.mx, defender.my), defender);
        assert.ok(attacker.mhpmax > 1);
        assert.equal(game.u.uexp, heroExperience);
        if (type === AD_FIRE) {
            assert.equal(floorObjects(game.level).filter(object => object.otyp === CORPSE).length, 0);
            assert.ok(messages.includes(`The ${species} burns completely!`));
        }
        else
            assert.ok(messages.includes(`The ${species} falls to pieces!`));
    });
}
for (const [label, type, armorType, field] of [
    ['rust', AD_RUST, CHAIN_MAIL, 'oeroded'],
    ['corrosion', AD_CORR, CHAIN_MAIL, 'oeroded2'],
    ['decay', AD_DCAY, LEATHER_ARMOR, 'oeroded2'],
]) {
    void test(`${label} erodes worn armor and clears waiting without hurting the body`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt('orc', 12, 10, MM_NOGRP | NO_MINVENT);
        const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
        defender.mhp = defender.mhpmax = 80;
        defender.mstrategy = STRAT_WAITFORU | STRAT_HEAL;
        const armor = await knownObject(armorType);
        await equipMonsterObject(defender, armor, W_ARM);
        const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, type, 1, 8], {
            visible: true, random: () => 1, rollDice: (count, sides) => count * sides,
            publish: async () => { },
        });
        assert.equal(armor[field], 1);
        assert.equal(defender.mhp, 80);
        assert.equal(result.damage, 0);
        assert.equal(defender.mstrategy, STRAT_HEAL);
    });
}
void test('acid harms the body and can corrode worn armor and the wielded weapon', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('acid blob', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('orc', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const armor = await knownObject(CHAIN_MAIL);
    const weapon = await knownObject(DAGGER);
    await equipMonsterObject(defender, armor, W_ARM);
    await equipMonsterObject(defender, weapon, W_WEP);
    const messages = [];
    await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_ACID, 1, 8], {
        visible: true, random: limit => limit === 5 ? 1 : 0, rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(defender.mhp, 72);
    assert.equal(armor.oeroded2, 1);
    assert.equal(weapon.oeroded2, 1);
    assert.equal(messages[0], 'The orc is covered in acid!');
    assert.equal(messages[1], 'It burns the orc!');
});
void test('an acid-resistant body takes no contact damage', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('acid blob', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('black naga', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const messages = [];
    const result = await resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_ACID, 1, 8], {
        visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.damage, 0);
    assert.equal(defender.mhp, 80);
    assert.deepEqual(messages, ['The black naga is covered in acid, but it seems harmless.']);
});
void test('an elemental resistance message resumes after a pending combat page', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('winter wolf', 12, 10, MM_NOGRP | NO_MINVENT);
    const defender = await createMonsterAt('winter wolf', 13, 10, MM_NOGRP | NO_MINVENT);
    defender.mhp = defender.mhpmax = 80;
    const input = resetInputState();
    await answerPrompts(resolveMonsterCombatDamage(attacker, defender, [AT_TUCH, AD_COLD, 1, 8], {
        visible: true, random: limit => limit - 1, rollDice: (count, sides) => count * sides,
    }), input, [{ prompt: /The winter wolf is covered in frost![\s\S]*--More--/, keys: ' ' }]);
    await flush_screen();
    assert.equal(defender.mhp, 80);
    const row = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(row, "The frost doesn't seem to chill the winter wolf!");
});
//# sourceMappingURL=monster_combat_elements.test.js.map