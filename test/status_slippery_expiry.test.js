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
void test('slippery fingers expiring during a meal display its deferred hunger state', async () => {
    const race = races.find(candidate => candidate.name === 'elf');
    assert.ok(race);
    const input = freshTurnRoom({
        role: 'ranger', race, flags: { pickup: false },
        hero: { uhunger: 880, uhs: NOT_HUNGRY, glib: true, glibTurns: 1 },
    });
    const food = await addInventoryObject(LEMBAS_WAFER);
    await bot();
    input.feed(`e${food.invlet}${' '.repeat(6)}`);
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.glibTurns, 0);
    assert.equal(game.u.uhs, SATIATED);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Satiated/);
});
//# sourceMappingURL=status_slippery_expiry.test.js.map