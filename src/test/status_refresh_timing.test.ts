import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NOT_HUNGRY, SATIATED } from '../js/const.js';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { LEMBAS_WAFER } from '../js/object_data.js';
import { races } from '../js/roles.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('the turn counter advances without displaying a meal hunger change', async () => {
    const race = races.find(candidate => candidate.name === 'elf');
    assert.ok(race);
    const input = freshTurnRoom({
        role: 'ranger', race, flags: { time: true, pickup: false },
        hero: { uhunger: 880, uhs: NOT_HUNGRY },
    });
    const food = await addInventoryObject(LEMBAS_WAFER);
    await bot();
    let pages = 0;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            assert.match(message, /A little goes a long way.*--More--/);
            const status = requireScreenRow(23).map(cell => cell.ch).join('');
            assert.match(status, /T:2\b/);
            assert.doesNotMatch(status, /Satiated/);
            pages++;
            return 32;
        },
    };
    input.feed(`e${food.invlet}`);

    await moveloop_core();
    await moveloop_core();

    assert.equal(pages, 1);
    assert.equal(game.u.uhs, SATIATED);
    await bot();
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Satiated/);
});
