import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble } from '../js/allmain.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { remove_object } from '../js/floor_object.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('restoring exposes a concealer whose saved hiding place has lost its cover', async () => {
    freshObjectRoom();
    installPagerInput(resetInputState(), { expected: /snake|welcome back/, limit: 4 });
    const snake = await createMonsterAt('garter snake', 15, 10, MM_NOGRP | NO_MINVENT);
    const cover = await floorObject(ROCK, 15, 10);
    await hideMonsterUnder(snake);
    assert.equal(!!snake.mundetected, true);
    remove_object(cover);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);

    await restoregamePreamble();

    const resident = requireGameLevel().monsters.find(monster => monster.m_id === snake.m_id);
    assert.ok(resident, 'The snake must still live on the restored level');
    assert.equal(!!resident.mundetected, false, 'A snake cannot remain hidden without cover');
});

