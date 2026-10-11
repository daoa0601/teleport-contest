import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, STONE, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { newsym } from '../js/display.js';
import { pushKey, pushKeys } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

function putStoneEast() {
    requireGameLevel().requireAt(11, 10).typ = STONE;
    newsym(11, 10);
}

async function addPick({ wielded = false } = {}) {
    const pick = await addInventoryObject(PICK_AXE, {
        invlet: 'a', spe: 0, wielded, owornmask: wielded ? W_WEP : 0,
    });
    if (wielded) game.uwep = game.u.uwep = pick;
    return pick;
}

void test('monster contact during the wield turn cancels the resumed pick swing', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const pick = await addPick();
    const jackal = await createMonsterAt('jackal', 10, 9, NO_MINVENT);
    jackal.mpeaceful = false;
    jackal.movement = 12;
    jackal.m_lev = 50;
    initRng(2n);
    pushKeys('aa');

    await moveloop_core();

    assert.equal(game.uwep, pick);
    const contactTurn = moveloop_core();
    await input.waitUntilBlocked();
    input.feed('l');
    await contactTurn;

    assert.ok(game.u.uhp < 100, 'the adjacent jackal should attack');
    assert.equal(game.u.ux, 11, 'the east key should be a new movement command');
});

void test('autodig performs its first digging action before advancing the world turn', async () => {
    freshTurnRoom();
    requirePlayingGame(game);
    await addPick({ wielded: true });
    putStoneEast();
    game.flags.autodig = true;
    const startingMove = game.moves;
    pushKey('l');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.moves, startingMove);
    assert.equal(game.u.ux, 10);
    assert.equal(requireGameLevel().requireAt(11, 10).typ, STONE);

    await moveloop_core();

    assert.equal(game.moves, startingMove + 1);
});
