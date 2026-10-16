import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { HVY_ENCUMBER, nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
async function strainedHero() {
    freshTurnRoom({ role: 'knight', heroLevel: 30 });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    game.flags.safe_wait = false;
    game.u.uhp = game.u.uhpmax = 1000;
    while (nearCapacity(game) < HVY_ENCUMBER)
        await addInventoryObject(ROCK, { quan: 10 });
    assert.equal(nearCapacity(game), HVY_ENCUMBER);
}
async function playTurns(turns, keys) {
    const input = resetInputState();
    let next = 0;
    input.beforeRead = () => {
        const display = requireGameDisplay();
        const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--'))
            input.feed(' ');
        else
            input.feed(keys[next++ % keys.length] ?? '.');
    };
    const target = game.moves + turns;
    for (let action = 0; game.moves < target && action < turns * 4; action++)
        await moveloop_core();
    assert.ok(game.moves >= target);
}
// C allmain.c moveloop_core(): a Strained hero who moved loses a hit point
// on every thirtieth turn (overexert_hp()); resting costs nothing.
void test('walking while Strained costs a hit point every thirty turns', async () => {
    await strainedHero();
    await playTurns(61, 'lh');
    assert.equal(game.u.uhp, 998);
});
void test('resting while Strained does not overexert the hero', async () => {
    await strainedHero();
    await playTurns(61, 's');
    assert.equal(game.u.uhp, 1000);
});
//# sourceMappingURL=encumbered_exertion.test.js.map