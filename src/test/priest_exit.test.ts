import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_YENDOR, DAGGER, POT_HEALING } from '../js/object_data.js';
import { clearNonlocalPriestsOnExit } from '../js/priest.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function priestAt(x: number, y: number, { local = false } = {}) {
    requirePlayingGame(game);
    const priest = await createMonsterAt('aligned cleric', x, y, NO_MINVENT | MM_NOGRP);
    priest.ispriest = 1;
    priest.epri = {
        parentmid: priest.m_id, shroom: 3, shralign: 0, shrpos: { x: 8, y: 8 },
        shrlevel: { dnum: game.u.uz.dnum, dlevel: game.u.uz.dlevel + (local ? 0 : 1) },
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    priest.mextra = { ...priest.mextra, epri: priest.epri };
    return priest;
}

void test('exit removes a nonlocal priest and ordinary cargo without counting a kill', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const priest = await priestAt(12, 10);
    const potion = await knownObject(POT_HEALING);
    const dagger = await knownObject(DAGGER);
    await addObjectToMonsterInventory(priest, potion);
    await addObjectToMonsterInventory(priest, dagger);
    game.program_state.gameover = true;

    await clearNonlocalPriestsOnExit();

    assert.equal(level.monsters.includes(priest), false);
    assert.equal(priest.dead, true);
    assert.equal(potion.where, 'gone');
    assert.equal(dagger.where, 'gone');
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.equal(game.mvitals?.[priest.mnum]?.died ?? 0, 0);
});

void test('a departing nonlocal priest leaves the real Amulet on the floor', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const priest = await priestAt(12, 10);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(priest, amulet);
    game.program_state.gameover = true;

    await clearNonlocalPriestsOnExit();

    assert.equal(level.monsters.includes(priest), false);
    assert.equal(floorObjectsAt(level, 12, 10).includes(amulet), true);
    assert.equal(amulet.where, 'floor');
});

void test('local priests, dead priests, and ordinary monsters remain after cleanup', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const local = await priestAt(12, 10, { local: true });
    const dead = await priestAt(13, 10);
    dead.mhp = 0;
    const orc = await createMonsterAt('orc', 14, 10, NO_MINVENT | MM_NOGRP);
    game.program_state.gameover = true;

    await clearNonlocalPriestsOnExit();

    assert.equal(level.monsters.includes(local), true);
    assert.ok(local.mhp > 0);
    assert.equal(level.monsters.includes(dead), true);
    assert.equal(level.monsters.includes(orc), true);
});

void test('cleanup removes every living nonlocal priest from the changing monster list', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const first = await priestAt(12, 10);
    const second = await priestAt(13, 10);
    const third = await priestAt(14, 10);
    game.program_state.gameover = true;

    await clearNonlocalPriestsOnExit();

    for (const priest of [first, second, third]) {
        assert.equal(level.monsters.includes(priest), false);
        assert.equal(priest.dead, true);
    }
});

void test('a priest on the same numbered depth in a different dungeon is nonlocal', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const priest = await priestAt(12, 10, { local: true });
    assert.ok(priest.epri);
    priest.epri.shrlevel.dnum++;
    game.program_state.gameover = true;

    await clearNonlocalPriestsOnExit();

    assert.equal(level.monsters.includes(priest), false);
});
