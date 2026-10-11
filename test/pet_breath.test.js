import test from 'node:test';
import assert from 'node:assert/strict';
import { runMonsterAbilityCommand } from './support/commands.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';
import { uninitializedObject } from './support/game-objects.js';
import { floorObjectQuantityAt } from './support/level-state.js';
import { installPagerInput } from './support/pager-input.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, MMOVE_DONE, MMOVE_NOTHING, NO_MINVENT, NO_WEAPON_WANTED, W_WEP, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { performPetRangedAttack, takeMonsterTurn } from '../js/monmove.js';
import { initRng, rn2, rnd } from '../js/rng.js';
const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;
async function redDragon() {
    const dragon = await createMonsterAt('red dragon', 10, 10, TEST_MONSTER_FLAGS);
    initializePet(dragon, { state: game });
    dragon.mhp = dragon.mhpmax = 100;
    return dragon;
}
async function breathTarget(species = 'orc-captain') {
    const target = await createMonsterAt(species, 13, 10, TEST_MONSTER_FLAGS);
    target.mhp = target.mhpmax = 100;
    return target;
}
void test('a tame dragon completes its breath attack instead of moving', async () => {
    freshRangedCombatRoom({ recalculateVision: true });
    requirePlayingGame(game);
    const dragon = await redDragon();
    const target = await breathTarget();
    assert.ok(dragon.edog);
    const hungryBefore = dragon.edog.hungrytime;
    installPagerInput(resetInputState(), {
        expected: /dragon|orc-captain|blast|fire|bounces/i, limit: 20,
    });
    initRng(1n);
    const action = await takeMonsterTurn(dragon, game);
    assert.equal(action.movement.postMoveStatus, MMOVE_DONE);
    assert.deepEqual([dragon.mx, dragon.my], [10, 10]);
    assert.ok(target.mhp < 100, 'the completed pet turn must apply breath damage');
    assert.ok((dragon.mspec_used ?? 0) > 0);
    assert.equal(dragon.edog.hungrytime, hungryBefore - 10);
});
void test('a rider in normal form can use a red dragon mount breath', async () => {
    freshPlayableRoom({ right: 20, role: 'knight', seed: 1n });
    requirePlayingGame(game);
    const steed = await redDragon();
    game.u.usteed = steed;
    const target = await breathTarget();
    target.mpeaceful = 1;
    assert.ok(steed.edog);
    const hungryBefore = steed.edog.hungrytime;
    installPagerInput(resetInputState(), {
        expected: /dragon|orc-captain|fire/, limit: 12,
    });
    await runMonsterAbilityCommand();
    assert.equal(game.context.move, 1);
    assert.ok((steed.mspec_used ?? 0) > 0);
    assert.equal(steed.edog.hungrytime, hungryBefore - 10);
    assert.ok(target.mhp < 100);
    assert.equal(target.mpeaceful, 1);
});
void test('a mounted dragon with no target snarls and spends the turn', async () => {
    freshPlayableRoom({ right: 20, role: 'knight', seed: 46003n });
    requirePlayingGame(game);
    game.u.usteed = await redDragon();
    await runMonsterAbilityCommand();
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /red dragon snarls/i);
});
void test('a pet completes its weapon and breath attacks before one full counterattack', async () => {
    freshRangedCombatRoom({ recalculateVision: true });
    requirePlayingGame(game);
    // Nazgul combines weapon and sleep breath; Aleax resists sleep and has two weapon attacks.
    const pet = await createMonsterAt('Nazgul', 10, 10, TEST_MONSTER_FLAGS);
    initializePet(pet, { state: game });
    pet.mhp = pet.mhpmax = 200;
    await equipMonsterObject(pet, await uninitializedObject(DAGGER), W_WEP);
    pet.weaponCheck = NO_WEAPON_WANTED;
    const target = await breathTarget('Aleax');
    target.mhp = target.mhpmax = 200;
    const daggers = await equipMonsterObject(target, await uninitializedObject(DAGGER, { quan: 4 }), W_WEP);
    target.weaponCheck = NO_WEAPON_WANTED;
    assert.ok(pet.edog);
    const hungryBefore = pet.edog.hungrytime;
    installPagerInput(resetInputState(), {
        expected: /Nazgul|Aleax|dagger|blast|sleep|bounces|wields/i, limit: 24,
    });
    initRng(1n);
    const result = await performPetRangedAttack(pet, game, {
        // Admit dogmove.c's optional counterattack; all other choices stay random.
        random: limit => limit === 4 ? 1 : rn2(limit),
        rollOne: sides => sides === 20 ? 1 : rnd(sides),
    });
    assert.equal(result.status, MMOVE_DONE);
    assert.ok(result.counterattack, 'the surviving Aleax must attempt its counterattack');
    assert.ok(target.mhp < 200);
    assert.equal(pet.edog.hungrytime, hungryBefore - 10, 'the Nazgul must also complete its sleep breath after the dagger lands');
    assert.equal(floorObjectQuantityAt(game.level, 13, 10, DAGGER), 1);
    assert.equal(daggers.quan, 2, 'one Aleax counterattack uses its two weapon attacks only once');
    assert.equal(floorObjectQuantityAt(game.level, 10, 10, DAGGER), 2);
    assert.ok(pet.mhp < 200, 'the Aleax return throws must damage the pet');
});
void test('poison gas from a pet breath blocks its target weapon counterattack', async () => {
    freshRangedCombatRoom({ recalculateVision: true });
    requirePlayingGame(game);
    const golem = await createMonsterAt('iron golem', 10, 10, TEST_MONSTER_FLAGS);
    initializePet(golem, { state: game });
    golem.mhp = golem.mhpmax = 200;
    await equipMonsterObject(golem, await uninitializedObject(DAGGER), W_WEP);
    golem.weaponCheck = NO_WEAPON_WANTED;
    const target = await breathTarget('ettin');
    target.mhp = target.mhpmax = 200;
    const daggers = await equipMonsterObject(target, await uninitializedObject(DAGGER, { quan: 4 }), W_WEP);
    target.weaponCheck = NO_WEAPON_WANTED;
    assert.ok(golem.edog);
    const hungryBefore = golem.edog.hungrytime;
    installPagerInput(resetInputState(), {
        expected: /golem|ettin|dagger|blast|gas|bounces|wields/i, limit: 24,
    });
    initRng(1n);
    const result = await performPetRangedAttack(golem, game, {
        // Admit dogmove.c's optional counterattack; all other choices stay random.
        random: limit => limit === 4 ? 1 : rn2(limit),
        rollOne: sides => sides === 20 ? 1 : rnd(sides),
    });
    assert.equal(result.status, MMOVE_DONE);
    assert.ok(result.counterattack, 'the sighted ettin should attempt a counterattack');
    assert.ok(target.mhp < 200);
    assert.equal(golem.edog.hungrytime, hungryBefore - 10, 'the iron golem must also complete its breath after the dagger lands');
    assert.equal(daggers.quan, 4, 'the poison clouds block both return throws');
    assert.equal(golem.mhp, 200);
    assert.equal(floorObjectQuantityAt(game.level, 10, 10, DAGGER), 0);
});
void test('a forced hungry pet snarls without attacking its available target', async () => {
    freshRangedCombatRoom({ recalculateVision: true });
    requirePlayingGame(game);
    const dragon = await redDragon();
    const target = await breathTarget();
    assert.ok(dragon.edog);
    dragon.edog.hungrytime = game.moves - 301;
    const hungryBefore = dragon.edog.hungrytime;
    installPagerInput(resetInputState(), { expected: /dragon|snarls/i, limit: 4 });
    const result = await performPetRangedAttack(dragon, game, {
        forced: true, random: limit => limit === 5 ? 4 : rn2(limit),
    });
    assert.equal(result.status, MMOVE_NOTHING);
    assert.equal(target.mhp, 100);
    assert.equal(dragon.edog.hungrytime, hungryBefore);
    assert.match(game._pending_message, /snarls/i);
});
void test('a cooling mount spends the commanded turn without a no-target snarl', async () => {
    freshPlayableRoom({ right: 20, role: 'knight', seed: 1n });
    requirePlayingGame(game);
    const steed = await redDragon();
    game.u.usteed = steed;
    steed.mspec_used = 5;
    const target = await breathTarget();
    assert.ok(steed.edog);
    const hungryBefore = steed.edog.hungrytime;
    await runMonsterAbilityCommand();
    assert.equal(game.context.move, 1);
    assert.equal(target.mhp, 100);
    assert.equal(steed.edog.hungrytime, hungryBefore);
    assert.doesNotMatch(game._pending_message, /snarls/i);
});
//# sourceMappingURL=pet_breath.test.js.map