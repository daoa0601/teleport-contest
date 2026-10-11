import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, G_NOCORPSE } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { pushKeys } from '../js/input.js';
import { nameToMonster, nameToMonsterClass } from '../js/mondata.js';
import { doClassGenocide, doGenocide } from '../js/genocide.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { CLUB, CRYSKNIFE, EGG, WORM_TOOTH } from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer,
} from '../js/object_timers.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('monster lookup accepts source names, plurals, and class descriptions', () => {
    assert.equal(nameToMonster('giant ants'), 0);
    assert.equal(nameToMonster('human werejackal'), 262);
    assert.equal(nameToMonsterClass('major demons'), 56);
    assert.equal(nameToMonsterClass('mummies'), 39);
});

void test('genocide removes the species, drops its inventory, and sterilizes eggs', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const carried = await knownObject(CLUB);
    const ant = await createMonsterAt('giant ant', 12, 10);
    await addObjectToMonsterInventory(ant, carried);
    const egg = await addInventoryObject(EGG, {
        initialize: false,
        corpsenm: 0,
    });
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, 200);
    pushKeys('giant ant\n');

    await doGenocide(1);

    const antVitals = game.mvitals[0];
    assert.ok(antVitals);
    const flags = antVitals.mvflags;
    const pile = floorObjectsAt(requireGameLevel(game), 12, 10);
    assert.equal(flags & (G_GENOD | G_NOCORPSE), G_GENOD | G_NOCORPSE);
    assert.equal(game.level.monsters.includes(ant), false);
    assert.equal(pile.includes(carried), true);
    assert.ok(egg.objectTimers !== null && egg.objectTimers !== undefined);
    assert.equal(egg.objectTimers.length, 0);
});

void test('a cursed genocide scroll sends in the chosen monsters', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    pushKeys('giant ant\n');

    await doGenocide(0);

    const ants = game.level.monsters.filter(monster => monster.mnum === 0);
    assert.ok(ants.length >= 4);
    assert.equal((game.mvitals[0]?.mvflags ?? 0) & G_GENOD, 0);
});

void test('blessed genocide applies to every permitted species in a class', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    pushKeys(`a\n${' '.repeat(40)}`);

    await doClassGenocide();

    for (let mnum = 0; mnum <= 5; mnum++)
        assert.ok((game.mvitals[mnum]?.mvflags ?? 0) & G_GENOD);
});

void test('genocide releases a carried fixed crysknife before its floor landing', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const orc = await createMonsterAt('orc', 12, 10);
    const knife = await knownObject(CRYSKNIFE, { oerodeproof: true });
    await addObjectToMonsterInventory(orc, knife);
    initRng(5n);
    pushKeys('orc\n        ');

    await doGenocide(1);

    assert.equal(game.level.monsters.includes(orc), false);
    assert.ok(floorObjectsAt(requireGameLevel(game), 12, 10).includes(knife));
    assert.equal(knife.otyp, WORM_TOOTH);
});
