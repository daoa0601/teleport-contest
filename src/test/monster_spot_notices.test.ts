// C hack.c:notice_mon() and notice_all_mons() behind the spot_monsters
// accessibility option (C a11y.mon_notices): postmov() announces a monster
// once per sighting, the vision catch-up names peaceful monsters with their
// own article rules in nearest-first order, and a hider that is only
// telepathically sensed stays quiet.

import test from 'node:test';
import assert from 'node:assert/strict';

import { performMonsterTurn } from '../js/allmain.js';
import { MM_NOGRP, NO_MINVENT, W_SADDLE } from '../js/const.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { noticeAllMonsters } from '../js/monster_notices.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function announcements(): string[] {
    return [...game._messageHistory, game._pending_message].filter(Boolean);
}

void test('spot_monsters announces a moving monster once per sighting', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const jackal = await createMonsterAt('jackal', 14, 10, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    jackal.msleeping = 0;
    initRng(11n);

    await performMonsterTurn(jackal, game);

    assert.ok(announcements().includes('You see a jackal.'),
        `postmov() announces the first sighting: ${announcements().join(' | ')}`);

    const seen = announcements().length;
    await performMonsterTurn(jackal, game);
    assert.ok(!announcements().slice(seen).includes('You see a jackal.'),
        'the mspotted latch keeps the second turn quiet');
});

void test('the vision catch-up announces nearest first and describes peaceful monsters', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const gnome = await createMonsterAt('gnome', 13, 10, NO_MINVENT);
    gnome.mpeaceful = 1;
    const newt = await createMonsterAt('newt', 11, 10, NO_MINVENT);
    newt.mpeaceful = 0;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.deepEqual(said, ['You see a newt.', 'You see a peaceful gnome.']);
});

void test('a telepathically sensed hider is not announced', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    setHeroBlindnessTurns(100);
    grantIntrinsicProperty('telepathy', 'outside');
    const piercer = await createMonsterAt('rock piercer', 13, 10, NO_MINVENT);
    piercer.mundetected = 1;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.deepEqual(said, []);
});

void test('a save made after notices ran keeps its latches through restore', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Spot saver';
    game.flags.spot_monsters = true;
    await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    await createMonsterAt('newt', 40, 10, NO_MINVENT);
    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });
    assert.ok(said.includes('You see a jackal.'), 'a monster is spotted before saving');

    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Spot saver', storage), true);
    // dorecover() repaints through docrt(); recompute sight the same way
    // before asking for notices.
    vision_recalc(0);
    // C savemon() writes the raw struct monst, so the spotted jackal stays
    // spotted after the restore instead of being announced again.
    const afterRestore: string[] = [];
    await noticeAllMonsters(game, async message => { afterRestore.push(message); });
    assert.ok(!afterRestore.includes('You see a jackal.'),
        `the latch survives the save: ${afterRestore.join(' | ')}`);
});

// C monmove.c:314-317: a monster that spends its turn eating never reaches
// postmov(), so its first sighting waits for the next vision recalculation
// instead of being announced by the movement presenter.
void test('an eating monster is not announced by its turn', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const jackal = await createMonsterAt('jackal', 14, 10, MM_NOGRP | NO_MINVENT);
    jackal.mpeaceful = 0;
    jackal.msleeping = 0;
    jackal.meating = 2;
    initRng(11n);

    await performMonsterTurn(jackal, game);

    assert.ok(!announcements().some(message => /^You (see|notice) /.test(message)),
        `a turn without postmov() announces nothing: ${announcements().join(' | ')}`);
});

// C hack.c:1721-1727: the saddle is suppressed only for a named monster,
// so an unnamed steed is announced as "your saddled pony".
void test('a saddled steed keeps its saddle in the announcement', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.flags.spot_monsters = true;
    const pony = await createMonsterAt('pony', game.u.ux, game.u.uy, NO_MINVENT);
    pony.mtame = 1;
    pony.misc_worn_check = (pony.misc_worn_check ?? 0) | W_SADDLE;
    game.u.usteed = pony;

    const said: string[] = [];
    await noticeAllMonsters(game, async message => { said.push(message); });

    assert.ok(said.includes('You see your saddled pony.'),
        `the unnamed steed is announced with its saddle: ${said.join(' | ')}`);
});
