import test from 'node:test';
import assert from 'node:assert/strict';
import { G_GENOD, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_GENO, MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
import { LONG_SWORD } from '../js/object_data.js';
// makemon.c:m_initweap() S_ANGEL gear and m_initgrp() group bounds.
const SILVER_MACE = 74;
const LARGE_SHIELD = 156;
const SHIELD_OF_REFLECTION = 158;
const G_LGROUP = 0x0040;
const G_SGROUP = 0x0080;
void test('golems are born with the fixed hit points of their material', async () => {
    const expectations = [
        ['straw golem', 20], ['paper golem', 20], ['rope golem', 30],
        ['leather golem', 40], ['gold golem', 60], ['wood golem', 50],
        ['flesh golem', 40], ['clay golem', 70], ['stone golem', 100],
        ['glass golem', 80], ['iron golem', 120],
    ];
    for (const [name, hp] of expectations) {
        freshObjectRoom({ gameplaySeed: 1n });
        const golem = await makemonAt(MONSTER_NAME.indexOf(name), 12, 10, MM_NOMSG | NO_MINVENT);
        assert.ok(golem, `${name} must be born`);
        assert.equal(golem.mhp, hp, `${name} has the golemhp() total`);
        assert.equal(golem.mhpmax, hp);
    }
});
void test('riders roll ten hit dice regardless of their menacing level', async () => {
    for (const name of ['Death', 'Pestilence', 'Famine']) {
        for (let seed = 1n; seed <= 8n; seed++) {
            freshObjectRoom({ gameplaySeed: seed });
            const rider = await makemonAt(MONSTER_NAME.indexOf(name), 12, 10, MM_NOMSG | NO_MINVENT);
            assert.ok(rider, `${name} must be born (seed ${seed})`);
            assert.ok(rider.mhp >= 11 && rider.mhp <= 80, `${name} hit points ${rider.mhp} outside 10d8 with the all-ones boost`);
            assert.equal(rider.mhpmax, rider.mhp);
        }
    }
});
void test('Angels are born with a blessed, rustproof weapon and a real shield', async () => {
    for (let seed = 1n; seed <= 24n; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const angel = await makemonAt(MONSTER_NAME.indexOf('Angel'), 12, 10, MM_NOMSG);
        assert.ok(angel);
        const weapon = angel.minvent.find(item => item.otyp === LONG_SWORD || item.otyp === SILVER_MACE);
        assert.ok(weapon, `Angel receives its minion weapon (seed ${seed})`);
        assert.equal(weapon.blessed, true, `the weapon is blessed (seed ${seed})`);
        assert.equal(weapon.cursed, false, `the weapon is not cursed (seed ${seed})`);
        assert.equal(weapon.oerodeproof, true, `the weapon is rustproof (seed ${seed})`);
        const enchantment = weapon.spe ?? 0;
        if (weapon.otyp === LONG_SWORD) {
            assert.ok(enchantment >= 0 && enchantment <= 3, `long sword enchantment ${enchantment} outside +0..+3 (seed ${seed})`);
        }
        else {
            assert.ok(enchantment >= 3 && enchantment <= 6, `silver mace enchantment ${enchantment} outside +3..+6 (seed ${seed})`);
        }
        assert.ok(angel.minvent.some(item => item.otyp === LARGE_SHIELD || item.otyp === SHIELD_OF_REFLECTION), `Angel receives a shield (seed ${seed})`);
    }
});
void test('Archon lords always carry a shield of reflection', async () => {
    for (let seed = 1n; seed <= 24n; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const archon = await makemonAt(MONSTER_NAME.indexOf('Archon'), 12, 10, MM_NOMSG);
        assert.ok(archon);
        assert.ok(archon.minvent.some(item => item.otyp === SHIELD_OF_REFLECTION), `Archon lords always carry the shield of reflection (seed ${seed})`);
    }
});
function genocideExcept(species) {
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, index) => ({
        born: 0, died: 0, mvflags: index === species ? 0 : G_GENOD,
    }));
}
void test('a small-group species birth adds a hostile cluster around the hero', async () => {
    const jackal = MONSTER_NAME.indexOf('jackal');
    assert.ok((MONSTER_GENO[jackal] ?? 0) & G_SGROUP, 'jackal is a small-group species');
    let groups = 0;
    for (let seed = 1n; seed <= 32n && groups < 4; seed++) {
        const level = freshObjectRoom({ gameplaySeed: seed });
        genocideExcept(jackal);
        const leader = await makemonAt(null, game.u.ux, game.u.uy, NO_MINVENT | MM_NOMSG);
        if (!leader)
            continue;
        const monsters = level.monsters;
        if (monsters.length === 1)
            continue;
        groups++;
        assert.ok(monsters.length >= 2 && monsters.length <= 4, `jackal small group has ${monsters.length} members (seed ${seed})`);
        assert.equal(monsters[0], leader, 'the group leader is created first');
        for (const member of monsters.slice(1)) {
            assert.equal(member.mnum, jackal, `group member keeps the leader's species (seed ${seed})`);
            assert.equal(member.mpeaceful, 0, 'group members are made hostile even when the species can be peaceful');
            assert.equal(member.mavenge, 0, 'group members start unvengeful');
        }
    }
    assert.ok(groups > 0, 'random jackal creation should sometimes produce a group');
});
void test('a large-group species birth can surround the hero with a swarm', async () => {
    const bee = MONSTER_NAME.indexOf('killer bee');
    assert.ok((MONSTER_GENO[bee] ?? 0) & G_LGROUP, 'killer bee is a large-group species');
    let groups = 0;
    let largest = 0;
    for (let seed = 1n; seed <= 64n && groups < 4; seed++) {
        const level = freshObjectRoom({ gameplaySeed: seed });
        genocideExcept(bee);
        const leader = await makemonAt(null, game.u.ux, game.u.uy, NO_MINVENT | MM_NOMSG);
        if (!leader)
            continue;
        const monsters = level.monsters;
        if (monsters.length === 1)
            continue;
        groups++;
        largest = Math.max(largest, monsters.length);
        assert.ok(monsters.length >= 2 && monsters.length <= 11, `killer bee group of ${monsters.length} exceeds the ten-member large group (seed ${seed})`);
        for (const member of monsters.slice(1)) {
            assert.equal(member.mpeaceful, 0, 'swarm members are hostile');
        }
    }
    assert.ok(groups > 0, 'random killer bee creation should sometimes produce a group');
    assert.ok(largest >= 3, `large groups reach beyond a pair (${largest} members)`);
});
//# sourceMappingURL=monster_birth_groups_and_hp.test.js.map