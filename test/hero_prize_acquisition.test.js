import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementEntries } from '../js/achievements.js';
import { rhack } from '../js/cmd.js';
import { ACH_MINE_PRIZE, ACH_SOKO_PRIZE, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { remove_object } from '../js/floor_object.js';
import { gameLogEvents } from '../js/gamelog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { isLevelPrize } from '../js/level_prize.js';
import { generateMinesEnd } from '../js/mklev.js';
import { searchMonsterItems } from '../js/monster_item_search.js';
import { AMULET_OF_REFLECTION, BAG_OF_HOLDING, LUCKSTONE } from '../js/object_data.js';
import { observeObject } from '../js/object_knowledge.js';
import { addPickedInventoryObject, pickupAtHero } from '../js/pickup.js';
import { dropInventoryObject, inventoryLetter } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshSpecialLevel } from './support/special-level.js';
async function placePrize(kind, type) {
    const prize = await floorObject(type, game.u.ux, game.u.uy, {
        initialize: false, achievement: true, nomerge: true,
    });
    game.context.achieveo = kind === 'mines'
        ? { mines_prize_oid: prize.o_id, mines_prize_otyp: type }
        : { soko_prize_oid: prize.o_id, soko_prize_otyp: type };
    return prize;
}
function acknowledgePrizeMessages() {
    installPagerInput(resetInputState(), {
        expected: /stone|amulet|bag|drop|pick|comparing|total/i,
        limit: 20,
    });
}
void test('the Mines prize merges on pickup and remains mergeable after dropping it', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const carried = await addInventoryObject(LUCKSTONE, { quan: 2, initialize: false });
    const prize = await placePrize('mines', LUCKSTONE);
    acknowledgePrizeMessages();
    await pickupAtHero();
    assert.equal(game.inventory.filter(object => object.otyp === LUCKSTONE).length, 1);
    assert.ok(game.inventory.includes(carried), 'The carried stack must retain its identity');
    assert.equal(carried.quan, 3);
    assert.equal(prize.where, 'gone');
    assert.equal(achievementEntries(game).filter(value => value === ACH_MINE_PRIZE).length, 1);
    const combined = await addInventoryObject(LUCKSTONE, { initialize: false });
    assert.equal(combined, carried);
    assert.equal(carried.quan, 4);
    // Native merging preserves how an object reached the floor, so make
    // both portions real hero drops rather than mixing one with level stock.
    pushKeys(`1${inventoryLetter(carried)}`);
    await rhack('d'.charCodeAt(0));
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)
        .find(object => object.otyp === LUCKSTONE)?.quan, 1);
    await dropInventoryObject(carried);
    const stones = floorObjectsAt(level, game.u.ux, game.u.uy)
        .filter(object => object.otyp === LUCKSTONE);
    assert.equal(stones.length, 1);
    assert.equal(stones[0]?.quan, 4);
    await pickupAtHero();
    assert.equal(game.inventory.find(object => object.otyp === LUCKSTONE)?.quan, 4);
    assert.equal(achievementEntries(game).filter(value => value === ACH_MINE_PRIZE).length, 1);
    assert.equal(gameLogEvents().filter(event => event.text === "acquired the Mines' End luckstone").length, 1);
});
for (const type of [BAG_OF_HOLDING, AMULET_OF_REFLECTION]) {
    void test(`an acquired Sokoban ${type === BAG_OF_HOLDING ? 'bag' : 'amulet'} becomes searchable when dropped`, async () => {
        const level = freshObjectRoom({ right: 24 });
        requirePlayingGame(game);
        const state = game;
        const prize = await placePrize('sokoban', type);
        const collector = await createMonsterAt('orc', 13, 10, NO_MINVENT | MM_NOGRP | MM_ANGRY);
        collector.mux = 20;
        collector.muy = 10;
        const originalGoal = { x: 20, y: 10 };
        const before = searchMonsterItems(collector, state, {
            goal: originalGoal, approach: 1, random: limit => limit - 1,
        });
        assert.deepEqual(before.goal, originalGoal, 'An unclaimed level prize must not attract the collector');
        acknowledgePrizeMessages();
        await pickupAtHero();
        await dropInventoryObject(prize);
        const after = searchMonsterItems(collector, state, {
            goal: originalGoal, approach: 1, random: limit => limit - 1,
        });
        assert.deepEqual(after.goal, { x: state.u.ux, y: state.u.uy });
        assert.ok(floorObjectsAt(level, state.u.ux, state.u.uy).includes(prize));
        assert.equal(isLevelPrize(prize, state), false);
        assert.equal(achievementEntries(state).filter(value => value === ACH_SOKO_PRIZE).length, 1);
        await pickupAtHero();
        assert.ok(state.inventory.includes(prize));
        assert.equal(achievementEntries(state).filter(value => value === ACH_SOKO_PRIZE).length, 1);
        assert.equal(gameLogEvents(state).filter(event => event.text.startsWith('acquired the Sokoban ')).length, 1);
    });
}
void test('picking up a lookalike does not claim the separately designated prize', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    const ordinary = await floorObject(LUCKSTONE, game.u.ux, game.u.uy, { initialize: false });
    const prize = await floorObject(LUCKSTONE, 12, 10, {
        initialize: false, achievement: true, nomerge: true,
    });
    game.context.achieveo = { mines_prize_oid: prize.o_id, mines_prize_otyp: LUCKSTONE };
    acknowledgePrizeMessages();
    await pickupAtHero();
    assert.ok(game.inventory.includes(ordinary));
    assert.equal(prize.where, 'floor');
    assert.equal(isLevelPrize(prize), true);
    assert.equal(achievementEntries(game).includes(ACH_MINE_PRIZE), false);
    assert.equal(gameLogEvents().some(event => event.text.includes("Mines' End")), false);
});
void test('the Lua-generated Mines prize records acquisition before merging its live identity', async () => {
    const active = freshSpecialLevel({ prototype: 'minend', variant: 1, seed: 101n, depth: 12 });
    await generateMinesEnd(active);
    requirePlayingGame(game);
    game.in_mklev = false;
    const prize = floorObjects(game.level).find(object => object.o_id === game.context.achieveo?.mines_prize_oid);
    assert.ok(prize, 'Mines generation must retain its real prize identity');
    const carried = await addInventoryObject(LUCKSTONE, {
        initialize: false, blessed: !!prize.blessed, cursed: !!prize.cursed,
        spe: prize.spe, known: !!prize.known, bknown: !!prize.bknown,
    });
    observeObject(prize);
    remove_object(prize);
    const acquired = await addPickedInventoryObject(prize);
    assert.equal(acquired.object, carried);
    assert.equal(carried.quan, 2);
    assert.equal(prize.where, 'gone');
    assert.equal(achievementEntries(game).includes(ACH_MINE_PRIZE), true);
    assert.equal(gameLogEvents().filter(event => event.text === "acquired the Mines' End luckstone").length, 1);
});
//# sourceMappingURL=hero_prize_acquisition.test.js.map