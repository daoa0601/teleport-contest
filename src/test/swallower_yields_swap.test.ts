import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

// C uhitm.c:do_attack() returns FALSE when a safe, unblocked monster yields
// to the hero.  display.h:sensemon() can spot the swallower itself while
// swallowed, so a blind telepathic hero inside a peaceful engulfer reaches
// domove_core() carries the zeroed vector into its ordinary move checks,
// where the second m_at() lookup finds the co-located swallower and offers
// domove_swap_with_pet(): the hero swaps places with it and spends the turn.
void test('a move into a yielding peaceful swallower swaps places with it', async () => {
    const input = freshTurnRoom({ role: 'wizard', heroLevel: 20, moves: 10 });
    requirePlayingGame(game);
    grantIntrinsicProperty('telepathy', 'outside');
    setHeroBlindnessTurns(50);
    const worm = await createMonsterAt('purple worm', 10, 10);
    worm.mpeaceful = 1;
    setHeroGrip(worm);
    game.u.uswallow = 1;
    game.u.ux = worm.mx;
    game.u.uy = worm.my;
    initRng(11n);
    input.feed('h');
    await moveloop_core();
    installPagerInput(input, { expected: /swap places|worm|^$/, limit: 4 });
    await finishAtCommandInput(input, moveloop_core, /swap places with|^$/);

    assert.equal(game.moves, 11, 'The yielded step still spends the turn');
    assert.match(game._lastPlineMessage ?? '', /swap places with/);
    assert.doesNotMatch(game._lastPlineMessage ?? '', /You hit/);
    assert.equal(game.u.uswallow, 1, 'The swap keeps the hero inside the engulfer');
});
