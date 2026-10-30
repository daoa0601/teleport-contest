import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNTAIN } from '../js/const.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { startLuaCore } from './support/lua-game.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>, dlevel = 6): void {
    freshPlayableRoom({
        role: 'knight', flags: { debug: true }, hero: { uz: { dnum: 0, dlevel } },
    });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}

function moveBonesFile(storage: ReturnType<typeof memoryStorage>, destination: number): void {
    const key = storage.key(0);
    assert.ok(key);
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    storage.removeItem(key);
    storage.setItem(`teleport-bones:0:${destination}`, encoded);
}

function answerBonesPrompts(get = 'y', unlink = 'y'): string[] {
    const screens: string[] = [];
    resetInputState().display = {
        async readKey() {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(text);
            assert.ok(screens.length < 30, `Unexpected bones input: ${text}`);
            return (text.includes('Get bones?') ? get
                : text.includes('Unlink bones?') ? unlink : ' ').charCodeAt(0);
        },
    };
    return screens;
}

for (const unlink of ['y', 'n']) {
    void test(`a wizard rejects bones from another depth and answers ${unlink} to unlinking`, async () => {
        const storage = memoryStorage();
        bonesRoom(storage);
        requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
        assert.equal(saveBonesLevel(), true);
        moveBonesFile(storage, 7);
        bonesRoom(storage, 7);
        const screens = answerBonesPrompts('y', unlink);

        await mklev();

        assert.equal(!!game._restoredBones, false);
        assert.equal(game.u.uroleplay?.numbones, 1);
        assert.equal(storage.length, unlink === 'y' ? 0 : 1);
        assert.equal(!!game.program_state.gameover, false);
        const messages = game._messageHistory.join('\n');
        assert.match(messages, /This is bones level 'D0\.6', not 'D0\.7'!/);
        assert.match(messages, /Strange, this map is not as I remember it\./);
        assert.match(messages, /Somebody is trying some trickery here\.\.\./);
        assert.match(messages, /This game is void\./);
        assert.ok(screens.some(screen => screen.includes('Unlink bones?')));
    });
}

void test('a wizard can decline mismatched bones before reading their identity', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    moveBonesFile(storage, 7);
    bonesRoom(storage, 7);
    answerBonesPrompts('n');

    await mklev();

    assert.equal(!!game._restoredBones, false);
    assert.equal(game.u.uroleplay?.numbones, 0);
    assert.equal(storage.length, 1);
    assert.doesNotMatch(game._messageHistory.join('\n'), /trickery|This is bones level/);
});

void test('mismatched bones void an ordinary game before level arrival', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    moveBonesFile(storage, 7);
    const { source } = freshConnectedLevels({ destinationDepth: 7, generateDestination: true });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    game.flags = { bones: true, disclose: 'none', tombstone: false };
    game.iflags.toptenwin = false;
    const screens = answerBonesPrompts();
    initRng(1n);

    await gotoLevel({ dlevel: 7 });

    assert.equal(game.program_state.gameover, true);
    assert.equal(game.level, source, 'a void game must not generate or arrive on a replacement level');
    assert.equal(game.u.uroleplay?.numbones, 0, 'native done() ends before bones bookkeeping');
    assert.ok(storage.getItem('teleport-bones:0:7'), 'the fatal path leaves the bones file in place');
    assert.equal(loadScoreRecords()[0]?.death, 'trickery');
    assert.ok(screens.some(screen => screen.includes('This game is void.')));
    assert.doesNotMatch(game._messageHistory.join('\n'), /You die|This is bones level/);
});

void test('a changed dungeon bones tag rejects a file at the same dungeon index', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.bonetag = 'M';
    answerBonesPrompts();

    await mklev();

    assert.equal(!!game._restoredBones, false);
    assert.match(game._messageHistory.join('\n'), /This is bones level 'D0\.6', not 'M0\.6'!/);
});

void test('quest bones retain the role code of their creator', async t => {
    const storage = memoryStorage();
    bonesRoom(storage);
    game.quest_dnum = 0;
    assert.equal(saveBonesLevel(), true);
    freshPlayableRoom({ role: 'wizard', flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 6 } } });
    game.dungeons = [createDungeon({ dname: 'The Quest', num_dunlevs: 10, bonetag: 'D' })];
    game.quest_dnum = 0;
    game.specialLevels = new Map([['Wiz-loca', createSpecialLevel({ dnum: 0, dlevel: 4 })]]);
    game.storage = storage;
    init_objects();
    await startLuaCore(t);
    answerBonesPrompts();

    await mklev();

    assert.equal(!!game._restoredBones, false);
    assert.match(game._messageHistory.join('\n'), /This is bones level 'DKni\.6', not 'DWiz\.6'!/);
});

void test('a special level bones tag permits restoration when its depth changes', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    game.specialLevels = new Map([['town', createSpecialLevel({ dnum: 0, dlevel: 6, bonetag: 'T' })]]);
    requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
    assert.equal(saveBonesLevel(), true);
    moveBonesFile(storage, 7);
    bonesRoom(storage, 7);
    game.specialLevels = new Map([['town', createSpecialLevel({ dnum: 0, dlevel: 7, bonetag: 'T' })]]);
    answerBonesPrompts();

    await mklev();

    assert.equal(game._restoredBones, true);
    assert.equal(requireGameLevel().requireAt(15, 10).typ, FOUNTAIN);
    assert.equal(game.u.uroleplay?.numbones, 1);
    assert.doesNotMatch(game._messageHistory.join('\n'), /trickery/);
});
