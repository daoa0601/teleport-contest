import { floorObjectsAt } from './support/level-state.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { NORMAL_SPEED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { gotoLevel } from '../js/level_change.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { monstersInFmonOrder, takeMonsterTurn } from '../js/monmove.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_YENDOR, CARROT, GOLD_PIECE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { runExtendedCommand } from './support/commands.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function steedInput() {
    const input = resetInputState();
    // One mount, dismount, meal or level transfer can emit at most one message
    // for the steed, the hero's landing, and the item left behind.
    installPagerInput(input, {
        expected: /(?:mount|dismount|off of) the saddled pony|pony (?:eats|devours|throws|bucks)|Amulet of Yendor|You descend/,
        limit: 3,
    });
    return input;
}

async function mountedPony() {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, pony);
    return pony;
}

void test('mounting clears map occupancy and dismounting restores it without relinking the actor', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const older = await createMonsterAt('lichen', 8, 10);
    const pony = await createSaddledSteed();
    const newer = await createMonsterAt('newt', 14, 10);
    await runExtendedCommand('ride', 'l');
    assert.equal(monsterAtPosition(game.level, game.u.ux, game.u.uy), null);
    assert.deepEqual(monstersInFmonOrder(game.level.monsters), [newer, pony, older]);

    await runExtendedCommand('ride');
    assert.equal(game.u.usteed, null);
    assert.equal(monsterAtPosition(game.level, pony.mx, pony.my), pony);
    assert.deepEqual(monstersInFmonOrder(game.level.monsters), [newer, pony, older]);
    assert.equal(game.level.monsters.length, 3);
});

void test('saving a mounted game restores one shared steed identity with no map slot', async () => {
    const pony = await mountedPony();
    requirePlayingGame(game);
    const storage = memoryStorage();
    game.plname = 'Rider';
    const id = pony.m_id;
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Rider', storage), true);
    const restored = game.level.monsters.find(monster => monster.m_id === id);
    assert.ok(restored);
    assert.equal(game.u.usteed, restored);
    assert.equal(monsterAtPosition(game.level, game.u.ux, game.u.uy), null);
    assert.equal(game.level.monsters.filter(monster => monster.m_id === id).length, 1);
    steedInput();
    await runExtendedCommand('ride');
    assert.equal(monsterAtPosition(game.level, restored.mx, restored.my), restored);
});

void test('a mounted pet can eat at the hero square but cannot fetch or choose its own destination', async () => {
    const pony = await mountedPony();
    requirePlayingGame(game);
    const carrot = await floorObject(CARROT, game.u.ux, game.u.uy);
    game._moveloopStarted = true;
    game.u.umovement = 0;
    game._heroTimePending = true;
    pony.movement = NORMAL_SPEED;
    const input = steedInput();
    await finishAtCommandInput(input, () => moveloop_core(), /pony eats an uncursed carrot\./);

    assert.equal(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(carrot), false);
    assert.ok(pony.meating !== undefined && pony.meating !== null, 'Expected pony.meating to be initialized');
    assert.ok(pony.meating > 0);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
    assert.equal(game.u.usteed, pony);

    pony.meating = 0;
    const gold = await floorObject(GOLD_PIECE, game.u.ux, game.u.uy, { quan: 10 });
    await floorObject(CARROT, game.u.ux + 2, game.u.uy);
    pony.movement = NORMAL_SPEED;
    game._heroTimePending = true;
    await finishAtCommandInput(input, () => moveloop_core(), /^$|pony eats an uncursed carrot\./);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(gold));
    assert.equal(pony.minvent.includes(gold), false);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
});

void test('Conflict can throw the rider while retaining the steed on the level', async () => {
    const pony = await mountedPony();
    requirePlayingGame(game);
    const health = game.u.uhp;
    grantIntrinsicProperty('conflict', 'outside');
    steedInput();
    initRng(1n);
    await takeMonsterTurn(pony, game);
    assert.equal(game.u.usteed, null);
    assert.ok(game.level.monsters.includes(pony));
    assert.equal(monsterAtPosition(game.level, pony.mx, pony.my), pony);
    assert.ok(game.u.uhp < health);
});

void test('the world scheduler recovers a mounted actor without independently moving it', async () => {
    const pony = await mountedPony();
    requirePlayingGame(game);
    game._moveloopStarted = true;
    game.u.umovement = 0;
    game._heroTimePending = true;
    pony.movement = 0;
    pony.mfrozen = 2;
    pony.mcanmove = 0;
    const input = steedInput();
    input.feed('.');
    await moveloop_core();
    assert.equal(pony.mfrozen, 1);
    input.feed('.');
    await moveloop_core();
    assert.equal(pony.mfrozen, 0);
    assert.equal(pony.mcanmove, 1);
    assert.equal(game.u.usteed, pony);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
    assert.equal(monsterAtPosition(game.level, pony.mx, pony.my), null);
});

void test('a helpless steed transfers levels with its rider and leaves special objects behind', async () => {
    const { source, destination } = freshConnectedLevels({ role: 'knight' });
    game.u.ulevel = 30;
    const pony = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(pony, amulet);
    pony.msleeping = 1;
    pony.mfrozen = 5;
    pony.mcanmove = 0;
    pony.mtrapped = 1;
    pony.meating = 3;
    steedInput();
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    assert.equal(game.level, destination);
    assert.equal(game.u.usteed, pony);
    assert.equal(source.monsters.includes(pony), false);
    assert.equal(destination.monsters.filter(monster => monster === pony).length, 1);
    assert.equal(pony.mx, game.u.ux);
    assert.equal(pony.my, game.u.uy);
    assert.equal(monsterAtPosition(destination, pony.mx, pony.my), null);
    assert.equal(pony.mtrapped, 0);
    assert.equal(pony.meating, 0);
    assert.equal(pony.minvent.includes(amulet), false);
    assert.equal(amulet.where, 'floor');


    assert.ok(floorObjectsAt(source, amulet.ox, amulet.oy).includes(amulet));
});
