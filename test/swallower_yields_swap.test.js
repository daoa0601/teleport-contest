import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
// C uhitm.c:do_attack() returns FALSE when a safe, unblocked monster yields
// to the hero.  display.h:sensemon() can spot the swallower itself while
// swallowed, so a blind telepathic hero inside a peaceful engulfer reaches
// that block.  domove_attackmon_at() then returns FALSE and hack.c
// domove_core() carries the zeroed vector straight into its shared tail:
// the whole non-swallowed prologue (air_turbulence(),
// slippery_ice_fumbling(), impaired_movement(), water_turbulence(), the
// bounds and run-trap checks, escape_from_sticky_mon()) belongs to the
// else branch, so even on the Plane of Air a yielded move never tumbles,
// and the second m_at() lookup offers domove_swap_with_pet() instead.
//
// do_attack()'s own blocked roll (1 in 7) is a chance outcome, so each seed
// is judged by what actually happened.
void test('a move into a yielding peaceful swallower swaps places without air turbulence', async () => {
    let swaps = 0;
    for (let seed = 1n; seed <= 12n; seed++) {
        const input = freshTurnRoom({ role: 'wizard', heroLevel: 20, moves: 10 });
        requirePlayingGame(game);
        game.air_level = { ...game.u.uz, flags: { town: false }, alignment: null };
        grantIntrinsicProperty('telepathy', 'outside');
        setHeroBlindnessTurns(50);
        const worm = await createMonsterAt('purple worm', 10, 10);
        worm.mpeaceful = 1;
        setHeroGrip(worm);
        game.u.uswallow = 1;
        game.u.ux = worm.mx;
        game.u.uy = worm.my;
        initRng(seed);
        installPagerInput(input, { expected: /swap places|worm|in the way|seem to move|^$/, limit: 4 });
        input.feed('h');
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /swap places with|in the way|seem to move|^$/);
        const message = game._lastPlineMessage ?? '';
        assert.doesNotMatch(message, /tumble|thin air|control your movements/, 'seed ' + seed + ': air_turbulence() must not run for a swallowed move');
        if (/in the way|seem to move/.test(message))
            continue; // do_attack() spent the step itself
        assert.match(message, /swap places with/, 'seed ' + seed);
        swaps++;
        assert.equal(game.moves, 11, 'seed ' + seed + ': the yielded step still spends the turn');
        assert.doesNotMatch(message, /You hit/, 'seed ' + seed);
        assert.equal(game.u.uswallow, 1, 'seed ' + seed + ': the swap keeps the hero inside the engulfer');
    }
    assert.ok(swaps > 0, 'At least one seed let the swallower yield');
});
//# sourceMappingURL=swallower_yields_swap.test.js.map