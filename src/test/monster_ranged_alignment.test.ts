import test from 'node:test';
import assert from 'node:assert/strict';
import {
    D_CLOSED, DOOR, LAVAWALL, M_AP_MONSTER, M_AP_OBJECT,
    MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT, STONE, WATER,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    monsterLinedUpWithHero, monsterLinedUpWithMonster,
} from '../js/monster_ranged_alignment.js';
import { BOULDER, WAN_STRIKING } from '../js/object_data.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;

for (const [x, y, aligned] of [[11, 10, true], [10, 10, false], [14, 6, true], [13, 7, false]] as const) {
    void test(`monster alignment from 18,10 to ${x},${y} respects straight lines and the seven-square range`, async () => {
        freshObjectRoom({ left: 2, right: 25, top: 2, bottom: 18, heroX: 10, heroY: 12 });
        requirePlayingGame(game);
        const source = await createMonsterAt('red dragon', 18, 10, TEST_MONSTER_FLAGS);
        const target = await createMonsterAt('orc', x, y, TEST_MONSTER_FLAGS);

        assert.equal(monsterLinedUpWithMonster(source, target, game), aligned);
        assert.equal(monsterLinedUpWithMonster(source, source, game), false);
    });
}

for (const species of ['orc', 'stone giant']) {
    void test(`a ${species} cannot aim at another monster through a boulder even with a striking wand`, async () => {
        freshObjectRoom({ left: 2, right: 25, heroX: 10, heroY: 12 });
        requirePlayingGame(game);
        const source = await createMonsterAt(species, 15, 10, TEST_MONSTER_FLAGS);
        const target = await createMonsterAt('jackal', 9, 10, TEST_MONSTER_FLAGS);
        await addObjectToMonsterInventory(source, await knownObject(WAN_STRIKING, { spe: 0 }));
        await floorObject(BOULDER, 12, 10);
        vision_recalc(0);

        assert.equal(monsterLinedUpWithMonster(source, target, game), false);
    });
}

void test('another ordinary monster between shooter and target does not block alignment', async () => {
    freshObjectRoom({ left: 2, right: 25, heroX: 10, heroY: 12 });
    requirePlayingGame(game);
    const source = await createMonsterAt('red dragon', 15, 10, TEST_MONSTER_FLAGS);
    const target = await createMonsterAt('orc', 9, 10, TEST_MONSTER_FLAGS);
    await createMonsterAt('pony', 12, 10, TEST_MONSTER_FLAGS);

    assert.equal(monsterLinedUpWithMonster(source, target, game), true);
});

void test('ordinary hero targeting can succeed or fail through a boulder-only obstruction', async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const source = await createMonsterAt('orc', 15, 10, TEST_MONSTER_FLAGS);
    source.mux = game.u.ux;
    source.muy = game.u.uy;
    await floorObject(BOULDER, 12, 10);
    vision_recalc(0);

    assert.equal(monsterLinedUpWithHero(source, game, () => 0), true);
    assert.equal(monsterLinedUpWithHero(source, game, range => range - 1), false);
});

for (const assistance of ['boulder throwing', 'striking wand']) {
    void test(`${assistance} permits hero targeting through boulders`, async () => {
        freshObjectRoom({ right: 25 });
        requirePlayingGame(game);
        const source = await createMonsterAt(assistance === 'boulder throwing' ? 'stone giant' : 'orc',
            15, 10, TEST_MONSTER_FLAGS);
        source.mux = game.u.ux;
        source.muy = game.u.uy;
        if (assistance === 'striking wand') {
            await addObjectToMonsterInventory(source, await knownObject(WAN_STRIKING, { spe: 0 }));
        }
        await floorObject(BOULDER, 12, 10);
        vision_recalc(0);

        assert.equal(monsterLinedUpWithHero(source, game, range => range - 1), true);
    });
}

for (const terrain of [STONE, DOOR, WATER, LAVAWALL]) {
    void test(`terrain ${terrain} blocks a boulder-ignoring monster's hero targeting`, async () => {
        const level = freshObjectRoom({ right: 25 });
        requirePlayingGame(game);
        const source = await createMonsterAt('stone giant', 15, 10, TEST_MONSTER_FLAGS);
        source.mux = game.u.ux;
        source.muy = game.u.uy;
        level.requireAt(12, 10).typ = terrain;
        if (terrain === DOOR) level.requireAt(12, 10).doormask = D_CLOSED;
        vision_note_blocker_change(12, 10);
        vision_recalc(0);

        assert.equal(monsterLinedUpWithHero(source, game, () => 0), false);
    });
}

void test('gas obstructs monster targeting but permits the hero-target terrain fallback', async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const source = await createMonsterAt('orc', 15, 10, TEST_MONSTER_FLAGS);
    const target = await createMonsterAt('pony', 9, 10, TEST_MONSTER_FLAGS);
    source.mux = game.u.ux;
    source.muy = game.u.uy;
    await createHarmlessGasCloudSelection(game, [{ x: 12, y: 10 }]);
    vision_recalc(0);

    assert.equal(monsterLinedUpWithMonster(source, target, game), false);
    assert.equal(monsterLinedUpWithHero(source, game, range => range - 1), true);
});

void test('hero alignment uses the retained apparent position instead of the live hero square', async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const source = await createMonsterAt('orc', 16, 10, TEST_MONSTER_FLAGS);
    source.mux = 12;
    source.muy = 12;

    assert.equal(monsterLinedUpWithHero(source, game), false);
    source.mux = source.mx;
    source.muy = source.my;
    assert.equal(monsterLinedUpWithHero(source, game), false);
});

void test('a disguised polymorphed hero can avoid ranged attention, unlike a monster-shaped disguise', async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    const source = await createMonsterAt('orc', 15, 10, TEST_MONSTER_FLAGS);
    source.mux = game.u.ux;
    source.muy = game.u.uy;
    installPolymorphedHero('small mimic');
    game.u.m_ap_type = M_AP_OBJECT;
    game.u.mappearance = BOULDER;

    assert.equal(monsterLinedUpWithHero(source, game, () => 1), false);
    assert.equal(monsterLinedUpWithHero(source, game, () => 0), true);
    game.u.m_ap_type = M_AP_MONSTER;
    game.u.mappearance = MONSTER_NAME.indexOf('orc');
    assert.equal(monsterLinedUpWithHero(source, game, () => 1), true);
});
