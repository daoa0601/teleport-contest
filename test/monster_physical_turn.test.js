import { monsterAtPosition } from '../js/monster_location.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, W_AMUL, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AT_BITE, AT_KICK, AT_TENT } from '../js/monster_attack_types.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, OBJECT_NAMES, RIN_CONFLICT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');
async function conflictFight(attacker = 'orc', target = 'hill giant') {
    freshObjectRoom({ flags: { verbose: true }, hero: { ulevel: 30, uhp: 20, uhpmax: 40 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const flags = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
    const aggressor = await createMonsterAt(attacker, 11, 10, flags);
    const defender = await createMonsterAt(target, 12, 10, flags);
    aggressor.m_lev = 20;
    aggressor.mhp = aggressor.mhpmax = 100;
    defender.mhp = defender.mhpmax = 100;
    defender.msleeping = 1;
    defender.movement = 0;
    vision_recalc(0);
    installPagerInput(resetInputState(), {
        expected: /orc|giant|shade|horse|mastodon|worm|shrieker|pudding|troll|blade|medallion|But wait|flayer|brain|Death|thought/,
        limit: 20,
    });
    return { aggressor, defender, state: game };
}
void test('an unarmed monster passes through a shade but still spends its successful attack turn', async () => {
    const { aggressor, defender, state } = await conflictFight('orc', 'shade');
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    const fight = action.conflictFight;
    assert.ok(fight?.attack.kind === 'monster-attack', 'Conflict should produce an adjacent attack');
    assert.equal(defender.mhp, 100);
    assert.equal(defender.msleeping, 0);
    assert.equal(fight.attack.results[0]?.damage, 0);
    assert.equal(fight.attack.struck, true, 'native passive settlement retains the successful accuracy strike');
    assert.equal(fight.consumed, true);
    assert.match(state._pending_message ?? '', /passes harmlessly through the shade/);
});
void test('a monster wielding silver can hurt a shade through the full turn owner', async () => {
    const { aggressor, defender, state } = await conflictFight('orc', 'shade');
    await equipMonsterObject(aggressor, await knownObject(SILVER_SABER), W_WEP);
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.ok(defender.mhp < 100, 'silver contact should inflict actual damage');
    assert.equal(action.conflictFight.attack.results[0]?.damage, 100 - defender.mhp);
    assert.equal(defender.msleeping, 0);
});
void test('a horse can bite thick skin but its kick inflicts no damage', async () => {
    const { aggressor, defender, state } = await conflictFight('horse', 'mastodon');
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const bite = action.conflictFight.attack.results.find(attack => attack.attackType === AT_BITE);
    const kick = action.conflictFight.attack.results.find(attack => attack.attackType === AT_KICK);
    assert.ok(bite?.type === 'bite' && bite.damage > 0);
    assert.ok(kick?.hit, 'the kick must land so the test exercises skin protection');
    assert.equal(kick.damage, 0);
    assert.equal(100 - defender.mhp, bite.damage);
});
void test('a purple worm leaves its shrieker bite victim alive for the following attack', async () => {
    const { aggressor, defender, state } = await conflictFight('purple worm', 'shrieker');
    aggressor.mspec_used = 3;
    defender.mhp = 2;
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const bite = action.conflictFight.attack.results[0];
    assert.equal(bite?.attackType, AT_BITE);
    assert.equal(bite.damage, 1, 'the bite must leave one hit point for the next slot');
    assert.ok(action.conflictFight.attack.results.some(attack => attack.attackIndex === 1));
});
void test('a monster Stormbringer attack drains its opponent and heals its actual wielder', async () => {
    const { aggressor, defender, state } = await conflictFight();
    await equipMonsterObject(aggressor, await artifactObject('Stormbringer'), W_WEP);
    aggressor.mhp = 10;
    const level = defender.m_lev;
    initRng(1n);
    await runMonsterAction(aggressor, state);
    assert.equal(defender.m_lev, level - 1);
    assert.ok(defender.mhp < 100);
    assert.ok(aggressor.mhp > 10);
    assert.equal(state.u.uhp, 20, 'another monster wielding Stormbringer cannot heal the hero');
});
void test('a monster iron weapon divides its surviving pudding target after damage', async () => {
    const { aggressor, defender, state } = await conflictFight('orc', 'brown pudding');
    await equipMonsterObject(aggressor, await knownObject(DAGGER), W_WEP);
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const clone = state.level.monsters.find(monster => monster !== defender && monster.mnum === defender.mnum);
    assert.ok(clone, 'the live monster attack must invoke pudding division');
    const damage = action.conflictFight.attack.results[0]?.damage;
    assert.ok(damage !== undefined && damage > 0);
    assert.equal(defender.mhp + clone.mhp, 100 - damage);
    assert.equal(defender.mhpmax, 100);
    assert.equal(clone.mhpmax, 100);
});
void test('a life-saved pudding still divides after a monster lethal weapon hit', async () => {
    const { aggressor, defender, state } = await conflictFight('orc', 'brown pudding');
    await equipMonsterObject(aggressor, await knownObject(DAGGER, { spe: 10 }), W_WEP);
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    defender.mhp = 1;
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.ok(state.level.monsters.includes(defender));
    assert.equal(amulet.where, 'gone');
    assert.ok(state.level.monsters.some(monster => monster !== defender && monster.mnum === defender.mnum));
    assert.equal(action.conflictFight.attack.defenderDied, false);
});
void test('a monster killed by Trollsbane leaves a troll corpse that cannot revive', async () => {
    const { aggressor, defender, state } = await conflictFight('orc', 'troll');
    await equipMonsterObject(aggressor, await artifactObject('Trollsbane'), W_WEP);
    defender.mhp = 1;
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const corpse = action.conflictFight.attack.death?.corpse;
    assert.ok(corpse, 'the native troll death should leave a corpse');
    assert.equal(corpse.norevive, true);
    assert.notEqual(monsterAtPosition(state.level, defender.mx, defender.my), defender);
});
void test('a fatal knockback beyond passive range still consumes the monster conflict turn', async () => {
    const { aggressor, defender, state } = await conflictFight('hill giant', 'orc');
    defender.mhp = 1;
    addTrap(state.level, PIT, 13, 10);
    addTrap(state.level, PIT, 14, 10);
    installPagerInput(resetInputState(), { expected: /giant|orc|pit/, limit: 8 });
    const action = await runMonsterAction(aggressor, state, () => 0, count => count, () => 1);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.notEqual(monsterAtPosition(state.level, defender.mx, defender.my), defender);
    assert.ok(defender.mx - aggressor.mx > 1, 'the fatal landing must be outside passive range');
    assert.equal(action.conflictFight.attack.struck, true);
    assert.equal(action.conflictFight.consumed, true);
    assert.equal(aggressor.mx, 11, 'Conflict must not grant a second ordinary action');
});
void test('a mind flayer stops trying to drain a headless opponent after its first tentacle hit', async () => {
    const { aggressor, defender, state } = await conflictFight('mind flayer', 'brown pudding');
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const tentacles = action.conflictFight.attack.results.filter(attack => attack.attackType === AT_TENT);
    assert.equal(tentacles.length, 1, 'later brain-draining slots must be skipped for this opponent');
    assert.equal(tentacles[0]?.damage, 0);
    assert.equal(100 - defender.mhp, action.conflictFight.attack.results[0]?.damage);
});
void test('cancellation does not stop a mind flayer from eating its opponent brain', async () => {
    const { aggressor, defender, state } = await conflictFight('mind flayer', 'hill giant');
    aggressor.mcan = 1;
    initRng(1n);
    const action = await runMonsterAction(aggressor, state);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    const tentacles = action.conflictFight.attack.results.filter(attack => attack.attackType === AT_TENT);
    assert.equal(tentacles.length, 3);
    for (const hit of tentacles) {
        assert.ok(hit.type === 'tentacle');
        assert.ok(hit.damage >= 3 && hit.damage <= 12, `brain contact must add 1 to 10 damage to its two physical points, received ${hit.damage}`);
    }
    const damage = action.conflictFight.attack.results.reduce((sum, hit) => {
        assert.ok(typeof hit.damage === 'number', 'each physical contact must report its damage');
        return sum + hit.damage;
    }, 0);
    assert.equal(100 - defender.mhp, damage);
});
void test('a fatal Rider brain meal still damages the Rider without growing the dead mind flayer', async () => {
    const { aggressor, defender, state } = await conflictFight('mind flayer', 'Death');
    defender.mhp = 2;
    const action = await runMonsterAction(aggressor, state, () => 0, count => count, () => 1);
    assert.ok(action.conflictFight?.attack.kind === 'monster-attack');
    assert.notEqual(monsterAtPosition(state.level, aggressor.mx, aggressor.my), aggressor);
    assert.notEqual(monsterAtPosition(state.level, defender.mx, defender.my), defender);
    assert.equal(aggressor.m_lev, 20);
    assert.equal(action.conflictFight.attack.death?.growth, null);
    assert.equal(action.conflictFight.attack.aggressorDied, true);
    assert.equal(action.conflictFight.attack.defenderDied, true);
});
//# sourceMappingURL=monster_physical_turn.test.js.map