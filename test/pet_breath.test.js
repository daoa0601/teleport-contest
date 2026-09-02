import test from 'node:test';
import assert from 'node:assert/strict';

import { runMonsterAbilityCommand } from './support/commands.js';
import { addMonsterToLevel } from './support/monsters.js';
import { freshCommandRoom } from './support/playable-room.js';
import {
    finishRangedAttacks, freshRangedCombatRoom, rangedPet, rangedTarget,
} from './support/ranged-combat.js';
import { carriedObject } from './support/game-objects.js';
import {
    floorObjectQuantityAt, floorObjectsAt,
} from './support/level-state.js';
import {
    resolveMonsterBreathAttack,
} from '../js/dogmove.js';
import { game } from '../js/gstate.js';
import { DAGGER } from '../js/object_data.js';
import {
    finishMonsterRayDeath, quietMonsterActionRng,
} from '../js/monmove.js';

function redDragon(options = {}) {
    return rangedPet('red dragon', {
        x: 10,
        y: 10,
        hitPoints: 100,
        level: 15,
        mtame: 20,
        ...options,
    });
}

function breathTarget(options = {}) {
    return rangedTarget('goblin', {
        x: 13,
        y: 10,
        hitPoints: 100,
        level: 4,
        mac: 100,
        ...options,
    });
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
        const dragon = addMonsterToLevel(redDragon());
        const target = addMonsterToLevel(breathTarget());

        const action = quietMonsterActionRng(
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
        assert.equal(dragon.edog.hungrytime, 990);
    });

test('a rider in normal form can use a red dragon mount breath', async () => {
    freshCommandRoom({ right: 20, role: 'knight', seed: 1n });
    const steed = redDragon();
    game.u.usteed = steed;
    const target = addMonsterToLevel(breathTarget({ mpeaceful: 1 }));

    await runMonsterAbilityCommand(' '.repeat(8));

    assert.equal(game.context.move, 1);
    assert.ok(steed.mspec_used > 0);
    assert.equal(steed.edog.hungrytime, 990);
    assert.ok(target.mhp < 100);
    assert.equal(target.mpeaceful, 1);
});

test('a mounted dragon with no target snarls and spends the turn', async () => {
    freshCommandRoom({ right: 20, role: 'knight', seed: 46003n });
    game.u.usteed = redDragon();

    await runMonsterAbilityCommand();

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /red dragon snarls/i);
});

test('an iron golem throws before using its breath attack', async () => {
    freshRangedCombatRoom({ gameplaySeed: 1n });
    const dagger = carriedObject(DAGGER);
    const golem = addMonsterToLevel(rangedPet('iron golem', {
        hitPoints: 200,
        level: 18,
        inventory: [dagger],
    }));
    const target = addMonsterToLevel(rangedTarget('ettin', {
        hitPoints: 200,
        level: 18,
        mac: 20,
    }));

    const action = quietMonsterActionRng(golem, game);
    finishRangedAttacks(action.movement.rangedAttacks, game, {
        random: () => 0,
    });
    const hitPointsAfterDagger = target.mhp;
    await resolveBreath(golem, action.movement.petBreath);

    const daggerLanded = floorObjectsAt(game.level, 12, 10)
        .some(object => object.otyp === DAGGER);
    assert.equal(daggerLanded, true);
    assert.ok(hitPointsAfterDagger < 200);
    assert.ok(target.mhp < hitPointsAfterDagger);
    assert.equal(golem.edog.hungrytime, 990);
});

test('a ranged target can throw weapons back at a pet', async () => {
    freshRangedCombatRoom();
    const dragon = addMonsterToLevel(redDragon());
    const daggers = carriedObject(DAGGER, { quan: 2 });
    const target = addMonsterToLevel(rangedTarget('orc-captain', {
        x: 13,
        hitPoints: 200,
        level: 10,
        inventory: [daggers],
    }));
    const action = quietMonsterActionRng(
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
