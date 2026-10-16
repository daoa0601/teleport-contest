import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_NODOOR, SQKY_BOARD } from '../js/const.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { dolook } from '../js/invent.js';
import { DART } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
// Record every topline the pager shows, then the unpaged final message.
function recordMessages() {
    const paged = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            paged.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '');
            return ' '.charCodeAt(0);
        },
    };
    return () => [...paged, game._pending_message ?? ''];
}
// C invent.c:look_here(): a blind hero who feels the doorway surface does
// not hear about the doorway again, whether walking onto it or using ':'.
for (const how of ['autopickup', 'look']) {
    void test(`blind ${how} on a doorway names the surface once`, async () => {
        freshObjectRoom({ flags: { pickup: false } });
        requireFixtureGame(game);
        const loc = requireGameLevel().at(game.u.ux, game.u.uy);
        assert.ok(loc);
        loc.typ = DOOR;
        loc.doormask = D_NODOOR;
        await floorObject(DART, game.u.ux, game.u.uy, { quan: 1 });
        setHeroBlindnessTurns(20);
        const messages = recordMessages();
        if (how === 'autopickup')
            await autopickupAtHero();
        else
            await dolook();
        const text = messages().join(' ');
        assert.match(text, /You try to feel what is lying here on the doorway\./);
        assert.match(text, /You feel here .*dart/);
        assert.doesNotMatch(text, /There is a doorway here/);
    });
}
// look_here() names a seen trap before the objects, exactly once.
void test('looking at an object on a seen trap names the trap once', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    addTrap(requireGameLevel(), SQKY_BOARD, game.u.ux, game.u.uy, { tseen: true });
    await floorObject(DART, game.u.ux, game.u.uy, { quan: 1 });
    const messages = recordMessages();
    await dolook();
    const text = messages().join(' ');
    assert.equal(text.match(/There is a squeaky board here\./g)?.length, 1);
    assert.match(text, /You see here .*dart/);
});
//# sourceMappingURL=look_here_terrain.test.js.map