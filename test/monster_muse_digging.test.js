import assert from 'node:assert/strict';
import test from 'node:test';
import { AIR, HOLE, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { WAN_DIGGING } from '../js/object_data.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
// C muse.c:use_defensive() MUSE_WAN_DIGGING. A failed pit construction and
// an occupied square share one report; a diggable level opens a hole that
// takes the digger off the level.
void test('a digger on air reports its failed pit like an occupied square', async () => {
    const level = freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    level.flags.hardfloor = true;
    level.requireAt(10, 10).typ = AIR;
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);
    const messages = [];
    const result = await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
        state: game, publish: message => { messages.push(message); }, rollOne: () => 1,
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(wand.spe, 2);
    assert.equal(level.traps.length, 0);
    assert.equal(monster.mtrapped ?? 0, 0);
    assert.ok(messages.includes('The air here is too hard to dig in.'), messages.join('\n'));
});
void test('a digger opens a hole and falls through to the next level', async () => {
    const level = freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    game.u.uz = { dnum: 0, dlevel: 5 };
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);
    const messages = [];
    const result = await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
        state: game, publish: message => { messages.push(message); }, rollOne: () => 1,
    });
    const hole = level.traps.find(trap => trap.tx === 10 && trap.ty === 10);
    assert.equal(result.nativeResult, 2);
    assert.equal(hole?.ttyp, HOLE);
    assert.equal(hole?.tseen, true);
    assert.equal(wand.spe, 2);
    assert.equal(level.monsters.includes(monster), false);
    assert.deepEqual(monster.migrationDestination, { dnum: 0, dlevel: 6 });
    assert.ok(messages.includes('The orc has made a hole in the floor.'), messages.join('\n'));
    assert.ok(messages.includes('The orc falls through...'), messages.join('\n'));
});
void test('a blind hero hears an unseen digger crash through the floor', async () => {
    const level = freshObjectRoom({ right: 25, heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    game.u.uz = { dnum: 0, dlevel: 5 };
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = monster.mhpmax = 100;
    const wand = await addObjectToMonsterInventory(monster, await knownObject(WAN_DIGGING, { spe: 3 }), game);
    assert.ok(wand);
    await makeBlinded(10, { state: game, talk: false });
    vision_recalc(0);
    const messages = [];
    await useMonsterDefensiveItem(monster, { kind: 'digging', object: wand }, {
        state: game, publish: message => { messages.push(message); }, rollOne: () => 1,
    });
    const hole = level.traps.find(trap => trap.tx === 10 && trap.ty === 10);
    assert.equal(hole?.ttyp, HOLE);
    assert.equal(hole?.tseen, true);
    assert.ok(messages.includes('You hear something crash through the floor.'), messages.join('\n'));
    assert.equal(messages.some(message => message.includes('made a hole')), false);
    assert.equal(messages.some(message => message.includes('falls through')), false);
});
//# sourceMappingURL=monster_muse_digging.test.js.map