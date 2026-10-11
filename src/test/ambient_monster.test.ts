import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { ROOM } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshTurnRoom } from './support/playable-room.js';

function ambientBirthRoom({ unseenRoom = true } = {}) {
    freshTurnRoom({ right: 14 });
    requirePlayingGame(game);
    if (unseenRoom) {
        for (let x = 50; x <= 56; x++) {
            for (let y = 10; y <= 15; y++) {
                const location = requireGameLevel().requireAt(x, y);
                location.typ = ROOM;
                location.lit = true;
            }
        }
    }
    vision_recalc(0);
    // Select the ordinary once-per-turn birth opportunity.
    initRng(167n);
    pushKeys('.\x1b' + ' '.repeat(40));
}

async function spendBirthTurn() {
    await moveloop_core();
    await moveloop_core();
}

void test('an ambient newborn has sight and can locate a visible hero', async () => {
    ambientBirthRoom();
    requirePlayingGame(game);

    await spendBirthTurn();

    assert.ok(requireGameLevel().monsters.length > 0);
    const monster = requireGameLevel().monsters[0];
    assert.ok(monster, 'an ambient monster must be born');
    assert.equal(monster.mcansee, 1);
    assert.equal(cansee(monster.mx, monster.my), false);

    await takeMonsterTurn(monster, game);

    assert.equal(monster.mux, game.u.ux);
    assert.equal(monster.muy, game.u.uy);
});

void test('ambient generation respects a level that forbids random monsters', async () => {
    ambientBirthRoom();
    requirePlayingGame(game);
    requireGameLevel().flags.rndmongen = false;

    await spendBirthTurn();

    assert.equal(requireGameLevel().monsters.length, 0);
});

void test('ambient generation can fall back to visible floor when no unseen square exists', async () => {
    ambientBirthRoom({ unseenRoom: false });
    requirePlayingGame(game);

    await spendBirthTurn();

    assert.ok(requireGameLevel().monsters.length > 0);
    for (const monster of requireGameLevel().monsters) {
        assert.equal(requireGameLevel().requireAt(monster.mx, monster.my).typ, ROOM);
        assert.equal(cansee(monster.mx, monster.my), true);
    }
});
