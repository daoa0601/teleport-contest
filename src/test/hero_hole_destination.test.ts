import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { prepareHoleFall } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createStaffedShop } from './support/shop.js';
import { createSpecialLevel } from './support/topology.js';

void test('a shopkeeper takes the indebted hero backpack before a hole fall', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.debit = 1;
    const rocks = await addInventoryObject(ROCK);
    const hole = addTrap(source, HOLE, 10, 10, { dst: { dnum: 0, dlevel: 2 } });
    pushKeys(' '.repeat(10));

    assert.ok(await prepareHoleFall(hole));

    assert.equal(game.inventory.includes(rocks), false);
    assert.ok(shopkeeper.minvent?.includes(rocks));
});

for (const invoked of [false, true]) {
    void test(`a hero hole fall ${invoked ? 'can reach the Sanctum after invocation' : 'stops above the Sanctum before invocation'}`, async () => {
        const { source } = freshConnectedLevels({ destinationDepth: 3 });
        requirePlayingGame(game);
        const dungeon = game.dungeons[0];
        assert.ok(dungeon);
        dungeon.flags.hellish = true;
        game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
        game.u.uevent = { invoked };
        const hole = addTrap(source, HOLE, 10, 10, { dst: { dnum: 0, dlevel: 3 } });
        pushKeys(' '.repeat(10));

        const fall = await prepareHoleFall(hole);

        assert.equal(fall?.destination.dlevel, invoked ? 3 : 2);
    });
}

for (const visitedLocate of [false, true]) {
    void test(`a hero hole fall ${visitedLocate ? 'can pass a visited quest locate level' : 'stops at an unvisited quest locate level'}`, async () => {
        const { source } = freshConnectedLevels({ destinationDepth: 5 });
        requirePlayingGame(game);
        game.quest_dnum = 0;
        game.specialLevels = new Map([['x-loca', createSpecialLevel({ dnum: 0, dlevel: 3 })]]);
        const dungeon = game.dungeons[0];
        assert.ok(dungeon);
        dungeon.dunlev_ureached = visitedLocate ? 3 : 1;
        const hole = addTrap(source, HOLE, 10, 10, { dst: { dnum: 0, dlevel: 5 } });
        pushKeys(' '.repeat(10));

        const fall = await prepareHoleFall(hole);

        assert.equal(fall?.destination.dlevel, visitedLocate ? 5 : 3);
    });
}

// C trap.c fall_through(): "fly down a shaft" needs controlled_flight, which
// only a deliberate plunge while Flying sets; Sokoban's forced fall of a
// flying hero still falls.
for (const plunge of [false, true]) {
    void test(`a flying hero ${plunge ? 'who plunges flies' : 'forced down in Sokoban falls'} down a deep shaft`, async () => {
        const { source } = freshConnectedLevels({ destinationDepth: 4 });
        requirePlayingGame(game);
        game.u.flying = true;
        if (!plunge) source.flags.sokoban_rules = true;
        const hole = addTrap(source, HOLE, 10, 10, { dst: { dnum: 0, dlevel: 4 } });
        pushKeys(' '.repeat(10));

        const fall = await prepareHoleFall(hole, { tookPlunge: plunge });

        assert.ok(fall);
        assert.match(String(game._pending_message ?? ''),
            plunge ? /You fly down a deep shaft!/ : /You fall down a deep shaft!/);
    });
}
