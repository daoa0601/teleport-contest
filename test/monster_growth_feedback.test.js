import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { AD_PHYS, AT_BITE } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { growMonster } from '../js/monster_growth.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a pet that grows after a kill is introduced as your adult companion', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    dog.m_lev = 3;
    dog.mhp = dog.mhpmax = 24;
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    defender.mhp = 1;
    const messages = [];
    await resolveMonsterCombatDamage(dog, defender, [AT_BITE, AD_PHYS, 1, 6], {
        state: game, visible: true, random: () => 1, rollOne: () => 1,
        rollDice: count => count, publish: message => { messages.push(message); },
    });
    assert.equal(defender.dead, true);
    assert.ok(messages.includes('Your little dog grows up into a dog.'), messages.join('\n'));
});
void test('growth into a male form explains the change of gender', async () => {
    freshObjectRoom();
    const kop = await createMonsterAt('Keystone Kop', 11, 10, NO_MINVENT);
    kop.female = true;
    kop.m_lev = 1;
    kop.mhp = kop.mhpmax = 8;
    const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    defender.mhp = 1;
    const messages = [];
    await resolveMonsterCombatDamage(kop, defender, [AT_BITE, AD_PHYS, 1, 6], {
        state: game, visible: true, random: () => 1, rollOne: () => 1,
        rollDice: count => count, publish: message => { messages.push(message); },
    });
    assert.equal(kop.female, false);
    assert.ok(messages.includes('The Keystone Kop changes into a male Kop Sergeant.'), messages.join('\n'));
});
void test('fatal growth describes the old body before changing its gender', async () => {
    freshObjectRoom();
    const bee = await createMonsterAt('killer bee', 11, 10, NO_MINVENT);
    bee.m_lev = 8;
    requireMonsterVital(MONSTER_NAME.indexOf('queen bee')).mvflags |= G_GENOD;
    const growth = growMonster(bee, { state: game, rollOne: () => 1 });
    assert.equal(growth.genocided, true);
    assert.equal(growth.message, 'As the killer bee grows up into a queen bee, it dies!');
});
//# sourceMappingURL=monster_growth_feedback.test.js.map