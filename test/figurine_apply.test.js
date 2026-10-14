import test from 'node:test';
import assert from 'node:assert/strict';
import { STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { FIGURINE } from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('apply transforms one figurine from a stack at the selected square', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    const species = MONSTER_NAME.indexOf('kitten');
    const figurine = await addInventoryObject(FIGURINE, { corpsenm: species, quan: 2 });
    await applyInventoryObject(figurine, 'l ');
    assert.equal(figurine.quan, 1);
    assert.ok(level.monsters.some(monster => monster.mnum === species
        && monster.mx === game.u.ux + 1 && monster.my === game.u.uy));
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /set the figurine beside you/);
});
void test('applying a cursed figurine cancels its pending transformation', async () => {
    freshPlayableRoom();
    const figurine = await addInventoryObject(FIGURINE, {
        corpsenm: MONSTER_NAME.indexOf('kitten'), cursed: true,
    });
    assert.ok(objectTimers(figurine).length > 0);
    await applyInventoryObject(figurine, 'l  ');
    assert.equal(figurine.where, 'gone');
    assert.equal(objectTimers(figurine).length, 0);
    assert.equal(game.context.move, 1);
});
void test('a figurine rejected by solid rock stays carried but takes time', async () => {
    const level = freshPlayableRoom();
    level.requireAt(game.u.ux + 1, game.u.uy).typ = STONE;
    const figurine = await addInventoryObject(FIGURINE, { corpsenm: MONSTER_NAME.indexOf('kitten') });
    await applyInventoryObject(figurine, 'l');
    assert.equal(figurine.where, 'inventory');
    assert.equal(game.context.move, 1);
    assert.equal(game._pending_message, 'You cannot place a figurine in solid rock!');
});
void test('arboreal stone blocks a figurine as a tree', async () => {
    const level = freshPlayableRoom();
    level.flags.arboreal = true;
    level.requireAt(game.u.ux + 1, game.u.uy).typ = STONE;
    const figurine = await addInventoryObject(FIGURINE, { corpsenm: MONSTER_NAME.indexOf('kitten') });
    await applyInventoryObject(figurine, 'l');
    assert.equal(game._pending_message, 'You cannot place a figurine in a tree!');
    assert.equal(figurine.where, 'inventory');
    assert.equal(game.context.move, 1);
});
void test('a wall-passing figurine can transform in solid rock', async () => {
    const level = freshPlayableRoom();
    level.requireAt(game.u.ux + 1, game.u.uy).typ = STONE;
    const species = MONSTER_NAME.indexOf('xorn');
    const figurine = await addInventoryObject(FIGURINE, { corpsenm: species });
    await applyInventoryObject(figurine, 'l');
    assert.equal(figurine.where, 'gone');
    assert.ok(level.monsters.some(monster => monster.mnum === species));
});
void test('a swallowed hero cannot activate a figurine or spend a turn trying', async () => {
    freshPlayableRoom();
    const figurine = await addInventoryObject(FIGURINE, { corpsenm: MONSTER_NAME.indexOf('kitten') });
    game.u.uswallow = true;
    game.u.ustuck = await createMonsterAt('purple worm', game.u.ux + 1, game.u.uy);
    await applyInventoryObject(figurine);
    assert.equal(figurine.where, 'inventory');
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, "You don't have enough room in here.");
});
//# sourceMappingURL=figurine_apply.test.js.map