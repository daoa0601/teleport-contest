import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
// Rest until the hero leaves its square or the turn budget runs out.
async function restingHeroMoves(turns) {
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => {
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        input.feed(text.includes('--More--') ? ' ' : 's');
    };
    const start = { x: game.u.ux, y: game.u.uy };
    const target = game.moves + turns;
    for (let action = 0; game.moves < target && action < turns * 4; action++) {
        await moveloop_core();
        if (game.u.ux !== start.x || game.u.uy !== start.y)
            return true;
    }
    return false;
}
function restingKnight() {
    freshTurnRoom({ role: 'knight', heroLevel: 30 });
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    game.flags.safe_wait = false;
    game.u.uhp = game.u.uhpmax = 1000;
}
// C allmain.c moveloop_core(): Teleportation has a 1-in-85 chance each turn
// to call tele(), even while the hero only rests.
void test('teleportitis eventually moves a resting hero', async () => {
    restingKnight();
    grantIntrinsicProperty('teleportation', 'outside');
    assert.equal(await restingHeroMoves(1000), true);
});
void test('a resting hero without teleportitis stays put', async () => {
    restingKnight();
    assert.equal(await restingHeroMoves(1000), false);
});
//# sourceMappingURL=teleportitis_turn.test.js.map