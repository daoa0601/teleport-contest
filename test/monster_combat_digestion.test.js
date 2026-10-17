import assert from 'node:assert/strict';
import test from 'node:test';
import { M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_MISS, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { summonMinion } from '../js/minion.js';
import { AT_ENGL } from '../js/monster_attack_types.js';
import { resolveMonsterCombatDamage } from '../js/monster_combat_damage.js';
import { resolveMonsterCombatEngulf } from '../js/monster_combat_engulf.js';
import { MONSTER_ATTACKS, MONSTER_NAME, requireMonsterData } from '../js/monster_data.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterAtPosition, placeMonsterAt } from '../js/monster_location.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectQuantityAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function digestionRoom(species, { minion = false } = {}) {
    const level = freshObjectRoom({ gameplaySeed: 97n, moves: 1000,
        flags: { verbose: true }, context: { mon_moving: true },
        hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const attacker = minion ? await summonMinion(0)
        : await createMonsterAt('purple worm', 11, 10, BIRTH_FLAGS);
    assert.ok(attacker);
    if (minion) {
        await changeMonsterForm(attacker, MONSTER_NAME.indexOf('purple worm'), game);
        placeMonsterAt(attacker, 11, 10);
    }
    const defender = await createMonsterAt(species, 12, 10, BIRTH_FLAGS);
    attacker.mhp = attacker.mhpmax = 100;
    defender.mhp = defender.mhpmax = 100;
    const attack = requireMonsterData(MONSTER_ATTACKS, attacker.mnum).find(slot => slot[0] === AT_ENGL);
    assert.ok(attack);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /swallows|Burrrrp|killed|destroyed|dies|collapses|drops dead|queasy|medallion|looks much better|regurgitated|explosion|rips open|indigestion|turns into|vanishes|looks healthy|shivers|warm|crackles|wide awake|firm/,
        limit: 24,
    });
    const digest = () => resolveMonsterCombatEngulf(attacker, defender, attack, {
        state: game, visible: true,
        resolveDamage: (source, target, slot) => resolveMonsterCombatDamage(source, target, slot, {
            state: game, visible: true,
        }),
    });
    return { level, attacker, defender, input, digest };
}
void test('digestion consumes the actual life saver and leaves possessions without a corpse or hero credit', async () => {
    const { level, attacker, defender, input, digest } = await digestionRoom('orc');
    setMonsterGivenName(defender, 'Sergeant Ironhide of the Dungeon Guard');
    const amulet = await equipMonsterObject(defender, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(defender, dagger);
    let observedSwallowedPair = false;
    input.beforeRead = () => {
        if (defender.mhp > 0 && level.monsters.includes(attacker) && level.monsters.includes(defender)
            && attacker.mx === defender.mx && attacker.my === defender.my) {
            observedSwallowedPair = true;
            assert.equal(monsterAtPosition(level, defender.mx, defender.my), attacker, 'The swallowed defender remains in the chain but must not occupy its map square');
        }
    };
    const result = await digest();
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.equal(observedSwallowedPair, true);
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(amulet.where, 'gone');
    assert.equal(dagger.where, 'floor');
    assert.equal(floorObjectQuantityAt(level, 12, 10, CORPSE), 0);
    assert.equal(monsterAtPosition(level, 12, 10), attacker);
    requirePlayingGame(game);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
});
for (const rider of ['Death', 'Pestilence', 'Famine']) {
    void test(`swallowing ${rider} kills the eater and restores the living Rider to the map`, async () => {
        const { level, attacker, defender, digest } = await digestionRoom(rider);
        const result = await digest();
        assert.equal(result.nativeResult, M_ATTK_AGR_DIED);
        assert.notEqual(monsterAtPosition(level, attacker.mx, attacker.my), attacker);
        assert.equal(defender.mhp, 100);
        assert.equal(monsterAtPosition(level, 12, 10), defender);
        requirePlayingGame(game);
        assert.equal(game.u.uconduct.killer ?? 0, 0);
    });
}
void test('life saving lets a Rider eater survive but ends digestion without damaging the Rider', async () => {
    const { level, attacker, defender, digest } = await digestionRoom('Death');
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const result = await digest();
    assert.equal(result.nativeResult, M_ATTK_MISS);
    assert.ok(attacker.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(defender.mhp, 100);
    assert.equal(monsterAtPosition(level, 11, 10), attacker);
    assert.equal(monsterAtPosition(level, 12, 10), defender);
});
void test('a swallowed gas spore explodes only inside its eater', async () => {
    const { level, attacker, defender, digest } = await digestionRoom('gas spore');
    const neighbor = await createMonsterAt('orc', 13, 10, BIRTH_FLAGS);
    neighbor.mhp = neighbor.mhpmax = 100;
    initRng(97n);
    const result = await digest();
    assert.equal(result.nativeResult, M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.ok(attacker.mhp > 0 && attacker.mhp < 100);
    assert.equal(neighbor.mhp, 100);
    assert.equal(game.u.uhp, 500);
    assert.equal(floorObjectQuantityAt(level, 12, 10, CORPSE), 0);
});
void test('a fatal internal gas-spore explosion still kills the swallowed spore', async () => {
    const { level, attacker, defender, digest } = await digestionRoom('gas spore');
    attacker.mhp = 1;
    const result = await digest();
    assert.equal(result.nativeResult, M_ATTK_AGR_DIED | M_ATTK_DEF_DIED);
    assert.notEqual(monsterAtPosition(level, attacker.mx, attacker.my), attacker);
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(monsterAtPosition(level, 12, 10), null);
    assert.equal(game.u.uhp, 500);
});
void test('a pet gets half a swallowed horse meal and quarter chewing time without ordinary feeding recovery', async () => {
    const { level, attacker, digest } = await digestionRoom('horse');
    initializePet(attacker, { state: game });
    const pet = attacker.edog;
    assert.ok(pet);
    pet.hungrytime = 900;
    pet.mhpmax_penalty = 12;
    attacker.mconf = 1;
    attacker.mflee = 1;
    attacker.mfleetim = 20;
    await digest();
    // Horse nutrition 300, multiplied by 2 for this gigantic pet, then halved.
    assert.equal(pet.hungrytime, 1200);
    assert.equal(attacker.meating, 7);
    assert.equal(pet.mhpmax_penalty, 12);
    assert.equal(attacker.mconf, 1);
    assert.equal(attacker.mfleetim, 20);
    assert.equal(floorObjectQuantityAt(level, 12, 10, CORPSE), 0);
});
void test('a tame minion digests its victim without pet nutrition or chewing time', async () => {
    const { attacker, defender, level, digest } = await digestionRoom('horse', { minion: true });
    attacker.mtame = 10;
    await digest();
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(attacker.meating ?? 0, 0);
});
void test('a swallowed wraith grants exactly one level and a short meal without nutrition', async () => {
    const { attacker, digest } = await digestionRoom('wraith');
    initializePet(attacker, { state: game });
    const pet = attacker.edog;
    assert.ok(pet);
    attacker.m_lev = 8;
    const hunger = pet.hungrytime;
    await digest();
    assert.equal(attacker.m_lev, 9);
    assert.equal(pet.hungrytime, hunger);
    // Wraiths can leave weightless corpses: three chewing turns round to one.
    assert.equal(attacker.meating, 1);
});
void test('digesting a nurse restores the eater before ordinary growth', async () => {
    const { attacker, digest } = await digestionRoom('nurse');
    attacker.mhp = 2;
    await digest();
    assert.ok(attacker.mhp >= 100);
    assert.ok(attacker.mhp <= attacker.mhpmax);
});
void test('digesting green slime changes the eater into slime after the victim dies', async () => {
    const { attacker, defender, level, digest } = await digestionRoom('green slime');
    await digest();
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(attacker.mnum, MONSTER_NAME.indexOf('green slime'));
    assert.ok(attacker.mhp > 0);
});
void test('a digested shapechanger reverts at death but its swallowed nurse form still heals the eater', async () => {
    const { attacker, defender, level, digest } = await digestionRoom('chameleon');
    await changeMonsterForm(defender, MONSTER_NAME.indexOf('nurse'), game);
    assert.equal(defender.mnum, MONSTER_NAME.indexOf('nurse'));
    assert.equal(defender.cham, MONSTER_NAME.indexOf('chameleon'));
    const oldForm = attacker.mnum;
    attacker.mhp = 2;
    await digest();
    assert.notEqual(monsterAtPosition(level, defender.mx, defender.my), defender);
    assert.equal(defender.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(attacker.mnum, oldForm);
    assert.ok(attacker.mhp >= 100);
});
void test('digesting a stalker grants permanent invisibility and stun from the original corpse species', async () => {
    const { attacker, digest } = await digestionRoom('stalker');
    await digest();
    assert.equal(attacker.perminvis, 1);
    assert.equal(attacker.mstun, 1);
});
void test('a deaf hero does not prevent the digestion burp from waking nearby monsters', async () => {
    const { attacker, digest } = await digestionRoom('horse');
    const near = await createMonsterAt('orc', 13, 10, BIRTH_FLAGS);
    const far = await createMonsterAt('orc', 15, 10, BIRTH_FLAGS);
    near.msleeping = far.msleeping = 1;
    game.u.deaf = true;
    await digest();
    assert.equal(near.msleeping, 0);
    assert.equal(far.msleeping, 1);
    assert.ok(attacker.mhp > 0);
});
//# sourceMappingURL=monster_combat_digestion.test.js.map