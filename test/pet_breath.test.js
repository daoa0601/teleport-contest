import test from 'node:test';
import assert from 'node:assert/strict';

import { runMonsterAbilityCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import {
    finishRangedAttacks, freshRangedCombatRoom,
} from './support/ranged-combat.js';
import { uninitializedObject } from './support/game-objects.js';
import {
    floorObjectQuantityAt, floorObjectsAt,
} from './support/level-state.js';
import {
    continueMonsterRangedTurn, resolveMonsterBreathAttack,
} from '../js/dogmove.js';
import {
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT,
} from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { DAGGER } from '../js/object_data.js';
import { finishMonsterRayDeath } from '../js/monster_death.js';
import { takeMonsterTurn } from '../js/monmove.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT
    | NO_MINVENT;

async function redDragon() {
    const dragon = await createMonsterAt(
        'red dragon', 10, 10, TEST_MONSTER_FLAGS,
    );
    tameMonster(dragon, game);
    dragon.mhp = dragon.mhpmax = 100;
    return dragon;
}

async function breathTarget(species = 'orc-captain') {
    const target = await createMonsterAt(
        species, 13, 10, TEST_MONSTER_FLAGS,
    );
    target.mhp = target.mhpmax = 100;
    return target;
}

async function resolveBreath(monster, breath, rollOne = () => 1) {
    return resolveMonsterBreathAttack(monster, breath, game, {
        publish: async () => {},
        random: () => 1,
        rollDice: (count, sides) => count * sides,
        rollOne,
        finishMonsterKill: (target, death) => finishMonsterRayDeath(
            target, death, game, async () => {}, () => 1,
        ),
    });
}

test('a tame dragon breathes at a distant monster instead of moving',
    async () => {
        freshRangedCombatRoom();
        const dragon = await redDragon();
        const target = await breathTarget();
        const hungryBefore = dragon.edog.hungrytime;

        const action = await takeMonsterTurn(
            dragon,
            game,
            () => 1,
            (count, sides) => count * sides,
            range => range,
        );

        assert.equal(action.movement.petBreath.target, target);
        assert.equal(action.movement.petBreath.launched, true);
        await resolveBreath(
            dragon, action.movement.petBreath, range => range,
        );

        assert.deepEqual([dragon.mx, dragon.my], [10, 10]);
        assert.ok(target.mhp < 100);
        assert.equal(dragon.mspec_used, 9);
        assert.equal(dragon.edog.hungrytime, hungryBefore - 10);
    });

test('a rider in normal form can use a red dragon mount breath', async () => {
    freshPlayableRoom({ right: 20, role: 'knight', seed: 1n });
    const steed = await redDragon();
    game.u.usteed = steed;
    const target = await breathTarget();
    target.mpeaceful = 1;
    const hungryBefore = steed.edog.hungrytime;

    await runMonsterAbilityCommand(' '.repeat(8));

    assert.equal(game.context.move, 1);
    assert.ok(steed.mspec_used > 0);
    assert.equal(steed.edog.hungrytime, hungryBefore - 10);
    assert.ok(target.mhp < 100);
    assert.equal(target.mpeaceful, 1);
});

test('a mounted dragon with no target snarls and spends the turn', async () => {
    freshPlayableRoom({ right: 20, role: 'knight', seed: 46003n });
    game.u.usteed = await redDragon();

    await runMonsterAbilityCommand();

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /red dragon snarls/i);
});

test('an iron golem throws before using its breath attack', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const dagger = uninitializedObject(DAGGER);
    const golem = await createMonsterAt(
        'iron golem', 9, 10, TEST_MONSTER_FLAGS,
    );
    tameMonster(golem, game);
    golem.mhp = golem.mhpmax = 200;
    addObjectToMonsterInventory(golem, dagger, game);
    const target = await createMonsterAt(
        'ettin', 12, 10, TEST_MONSTER_FLAGS,
    );
    target.mhp = target.mhpmax = 200;
    const hungryBefore = golem.edog.hungrytime;

    const action = await takeMonsterTurn(golem, game);
    await finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });
    const hitPointsAfterDagger = target.mhp;
    const breath = (await continueMonsterRangedTurn(
        action.movement.petRangedTurn,
        game,
        { random: () => 1 },
    ))?.attack;
    await resolveBreath(golem, breath);

    const daggerLanded = floorObjectsAt(game.level, 12, 10)
        .some(object => object.otyp === DAGGER);
    assert.equal(daggerLanded, true);
    assert.ok(hitPointsAfterDagger < 200);
    assert.ok(target.mhp < hitPointsAfterDagger);
    assert.equal(golem.edog.hungrytime, hungryBefore - 10);
});

test('a ranged target can throw weapons back at a pet', async () => {
    freshRangedCombatRoom();
    const dragon = await redDragon();
    const daggers = uninitializedObject(DAGGER, { quan: 2 });
    const target = await breathTarget();
    target.mhp = target.mhpmax = 200;
    addObjectToMonsterInventory(target, daggers, game);
    const action = await takeMonsterTurn(
        dragon,
        game,
        () => 1,
        (count, sides) => count * sides,
        range => range,
    );

    await resolveBreath(dragon, action.movement.petBreath);

    assert.ok(target.mhp < 200);
    assert.ok(dragon.mhp < 100);
    assert.equal(floorObjectQuantityAt(game.level, 10, 10, DAGGER), 2);
});
