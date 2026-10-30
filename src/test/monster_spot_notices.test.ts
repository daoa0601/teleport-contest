// C hack.c:notice_mon() and notice_all_mons() behind the spot_monsters
// accessibility option (C a11y.mon_notices): postmov() announces a monster
// once per sighting, the vision catch-up names peaceful monsters with their
// own article rules in nearest-first order, and a hider that is only
// telepathically sensed stays quiet.

import test from 'node:test';
import assert from 'node:assert/strict';

import { performMonsterTurn } from '../js/allmain.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { noticeAllMonsters } from '../js/monster_notices.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
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
    assert.equal(jackal.mspotted, 1);

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
    assert.notEqual(piercer.mspotted, 1);
});
