import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble } from '../js/allmain.js';
import { flushPendingTopline } from '../js/display.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { remove_object } from '../js/floor_object.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { restoreGame, saveGame } from '../js/save.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('restoring exposes a concealer whose saved hiding place has lost its cover', async () => {
    freshObjectRoom();
    installPagerInput(resetInputState(), { expected: /Restoring save file|snake|welcome back/, limit: 4 });
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

void test('the restore announcement precedes sensed shape fixups and the welcome', async () => {
    freshObjectRoom();
    game.detectMonsters = true;
    const shapechanger = await createMonsterAt('chameleon', 14, 10, MM_NOGRP | NO_MINVENT);
    await changeMonsterForm(shapechanger, MONSTER_NAME.indexOf('little dog'));
    shapechanger.mcan = true;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /Restoring save file|turns into|welcome back/, limit: 4 });

    await restoregamePreamble();
    await flushPendingTopline();

    const text = messages.join('\n');
    const announcement = text.indexOf('Restoring save file...');
    const fixup = text.indexOf('turns into');
    assert.ok(announcement >= 0 && fixup > announcement && text.indexOf('welcome back') > fixup,
        `Restore messages are out of order: ${text}`);
});

