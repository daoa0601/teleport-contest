import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

// C hack.c:domove_core() reaches its shared target-monster block even when
// the destination is the engulfer holding the hero: nomul(0) there ends a
// rush or count-prefixed walk before do_attack(), so striking the swallower
// consumes exactly one turn and the engine returns to command input.
for (const keys of ['4h', 'gh'] as const) {
    void test(`a swallowed ${keys === '4h' ? 'counted walk' : 'g-rush'} that strikes the engulfer ends after one attack`, async () => {
        const input = freshTurnRoom({ role: 'wizard', heroLevel: 20, moves: 5, seed: 3n });
        requirePlayingGame(game);
        const jelly = await createMonsterAt('ochre jelly', 10, 10, NO_MINVENT);
        jelly.mhp = jelly.mhpmax = 500;
        setHeroGrip(jelly);
        game.u.uswallow = 1;
        game.u.ux = jelly.mx;
        game.u.uy = jelly.my;
        installPagerInput(input, { expected: /jelly|hit|miss|bash|bare|debris|pummeled/i, limit: 6 });

        input.feed(keys);
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /jelly|^$/);
        assert.equal(game.moves, 6, 'Only the swallowed attack itself takes a turn');
        assert.equal(game.multi, 0, 'The remaining repeats are canceled');
        assert.equal(game._runState, null, 'No rush survives the swallowed attack');
        assert.ok(jelly.mhp < 500, 'The engulfer was struck exactly once');
    });
}
