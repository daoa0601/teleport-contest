import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { DART, DAGGER, ROCK } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('scattered poisoned weapons can kill a monster with their poison', async () => {
    freshObjectRoom();
    game.context.mon_moving = true;
    const soldier = await createMonsterAt('soldier', 13, 10);
    soldier.mhp = soldier.mhpmax = 100;
    await floorObject(DART, 14, 10, { opoisoned: true });

    await scatterFloorObjects(14, 10, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
        finishMonsterDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
    });

    assert.equal(soldier.dead, true);
});

void test('a weapon landing after a fatal scatter hit is drawn on the vacated square', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 13, 10);
    soldier.mhp = 1;
    const dagger = await floorObject(DAGGER, 14, 10);
    await flush_screen(1);

    await scatterFloorObjects(14, 10, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });
    await flush_screen(1);

    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.ox, 13);
    assert.equal(requireScreenRow(11)[12]?.ch, ')');
});

void test('a scattered stone passes harmlessly through a xorn', async () => {
    freshObjectRoom();
    const xorn = await createMonsterAt('xorn', 13, 10);
    const hp = xorn.mhp;
    await floorObject(ROCK, 14, 10);

    await scatterFloorObjects(14, 10, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });

    assert.equal(xorn.mhp, hp);
});

void test('a scattered weapon touching a rust monster rusts before it lands', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('rust monster', 13, 10);
    monster.mhp = monster.mhpmax = 100;
    const dagger = await floorObject(DAGGER, 14, 10);

    await scatterFloorObjects(14, 10, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });

    assert.equal(dagger.oeroded, 1);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.ox, 13);
});
