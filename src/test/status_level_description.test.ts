import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

void test('Fort Ludios uses its dungeon name instead of its numerical depth', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'Fort Ludios', depth_start: 20 })];
    game.knox_level = createSpecialLevel({ dnum: 0, dlevel: 8 });

    await bot();

    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.ok(row.startsWith('Fort Ludios $:0 HP:'));
});

void test('quest home numbering follows the quest branch identity', async () => {
    freshObjectRoom();
    game.quest_dnum = 0;
    game.dungeons = [createDungeon({ dname: 'Renamed Quest', depth_start: 15 })];

    await bot();

    const row = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.ok(row.startsWith('Home 8 $:0 HP:'));
});
