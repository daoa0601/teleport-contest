import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

// C pickup.c:loot_mon() calls pickup() directly over the engulfer's stomach;
// only hack.c:dopickup() (the ',' command) runs pickup_checks(), whose
// "kind of slimy tongue" complaint spends a turn.  #loot inside an empty
// stomach therefore reports "You don't find anything here to loot." from
// doloot()'s own tail and takes no time at all.
void test('looting an empty engulfer stomach finds nothing and takes no turn', async () => {
    freshTurnRoom({ role: 'wizard', heroLevel: 20, moves: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 10, 10);
    worm.minvent = [];
    worm.inventory = [];
    worm.hasInventory = false;
    setHeroGrip(worm);
    game.u.uswallow = 1;
    game.u.ux = worm.mx;
    game.u.uy = worm.my;
    pushKeys('#loot\r.\x1b');

    await moveloop_core();

    assert.equal(game.moves, 10, 'The failed loot attempt takes no turn');
    assert.equal(game._pending_message, "You don't find anything here to loot.");
    assert.notEqual(game._pending_message, "But it's kind of slimy, so you drop it.");
});
