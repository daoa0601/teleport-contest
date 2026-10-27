import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { punishHero } from '../js/punishment.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
import { CLUB } from '../js/object_data.js';
// pickup.c: drag_ball() leaves the punishment chain trailing the hero, and
// whenever the hero steps onto its square autopick() selects it —
// autopick_testobj() has no chain exception and the CHAIN class passes the
// default empty pickup_types.  pickup()'s menu_pickup path then runs
// reset_justpicked() over the inventory before pickup_object() silently
// refuses uchain, so the just-picked marks die on that move even though
// nothing new is picked up.
void test('moving while punished clears the just-picked marks at the chain', async () => {
    freshPlayableRoom({ seed: 32001n });
    requirePlayingGame(game);
    game.flags.pickup = true;
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball|Things that are here/i,
        limit: 8,
    });
    const club = await addInventoryObject(CLUB, { invlet: 'a', pickup_prev: true });
    await punishHero();
    const ball = game.uball, chain = game.uchain;
    assert.ok(ball && chain);
    // Pick the chained ball up off the floor; it becomes the only item
    // marked as just picked up.
    await rhack(','.charCodeAt(0));
    assert.equal(game.inventory.includes(ball), true);
    assert.equal(club.pickup_prev, false);
    assert.equal(ball.pickup_prev, true, 'picking the ball up marks it just picked');
    // Stepping away drags the chain along one square behind, so the new
    // square holds nothing and keeps the marks; stepping back onto the
    // chain square makes the autopickup attempt over the chain, which
    // clears them.
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    assert.equal(ball.pickup_prev, true, 'a square without the chain keeps the just-picked marks');
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(chain), 'the hero stands on the chain again');
    assert.equal(game.inventory.includes(ball), true, 'the ball stays carried');
    assert.equal(ball.pickup_prev, false, 'the chain-only autopickup attempt clears the just-picked marks');
});
// The chain only clears marks that autopickup still selects: with the
// chain class refused, stepping onto the chain square selects nothing
// and the marks survive the move.
void test('a refused chain class leaves the just-picked marks alone', async () => {
    freshPlayableRoom({ seed: 32001n });
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.flags.pickup_types = '"';
    installPagerInput(resetInputState(), {
        expected: /punish|iron ball|Things that are here/i,
        limit: 8,
    });
    const club = await addInventoryObject(CLUB, { invlet: 'a', pickup_prev: true });
    await punishHero();
    const chain = game.uchain;
    assert.ok(chain);
    assert.ok(floorObjectsAt(game.level, game.u.ux, game.u.uy).includes(chain));
    await rhack('l'.charCodeAt(0));
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 10, 'the hero stepped back onto the chain');
    assert.equal(game.u.uy, 10);
    assert.equal(club.pickup_prev, true, 'a chain outside pickup_types selects nothing and keeps the marks');
});
//# sourceMappingURL=just_picked_chain.test.js.map