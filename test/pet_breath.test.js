import test from 'node:test';
import assert from 'node:assert/strict';

import { runMonsterAbilityCommand } from './support/commands.js';
import { addMonster, addPet, livePet } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshCommandRoom } from './support/playable-room.js';
import {
    resolveMonsterBreathAttack,
} from '../js/dogmove.js';
import { game } from '../js/gstate.js';
import {
    finishMonsterRayDeath, quietMonsterActionRng,
} from '../js/monmove.js';

function redDragonOptions(options = {}) {
    return {
        species: 'red dragon',
        x: 10,
        y: 10,
        hitPoints: 100,
        level: 15,
        mtame: 20,
        edog: { hungrytime: 1000 },
        ...options,
    };
}

function redDragon(options = {}) {
    return livePet(redDragonOptions(options));
}

function addRedDragon(options = {}) {
    return addPet(redDragonOptions(options));
}

function addBreathTarget(options = {}) {
    return addMonster({
        species: 'goblin',
        x: 13,
        y: 10,
        hitPoints: 100,
        level: 4,
        mac: 100,
        ...options,
    });
}

test('a tame dragon breathes at a distant monster instead of moving',
    async () => {
        freshObjectRoom({
            right: 20,
            heroX: 18,
            heroY: 12,
            recalculateVision: false,
        });
        const dragon = addRedDragon();
        const target = addBreathTarget();

        const action = quietMonsterActionRng(
            dragon,
            game,
            () => 1,
            (count, sides) => count * sides,
            range => range,
        );

        assert.equal(action.movement.petBreath.target, target);
        assert.equal(action.movement.petBreath.launched, true);
        await resolveMonsterBreathAttack(
            dragon, action.movement.petBreath, game, {
                publish: async () => {},
                random: () => 1,
                rollDice: (count, sides) => count * sides,
                rollOne: range => range,
                finishMonsterKill: (monster, death) =>
                    finishMonsterRayDeath(
                        monster, death, game, async () => {}, () => 1,
                    ),
            },
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
    const target = addBreathTarget({ mpeaceful: 1 });

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
