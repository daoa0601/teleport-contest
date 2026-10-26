import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGrip } from '../js/hero_grip.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
// C hack.c:domove_core() reaches its shared target-monster block even when
// the destination is the engulfer holding the hero: nomul(0) there ends a
// rush or count-prefixed walk before do_attack(), so striking the swallower
// consumes exactly one turn and the engine returns to command input.  The
// attack itself may hit or miss by chance, so each seed is judged by the
// turn count: one command, one turn, no surviving repeat state.
for (const keys of ['4h', 'gh']) {
    void test(`a swallowed ${keys === '4h' ? 'counted walk' : 'g-rush'} that strikes the engulfer ends after one attack`, async () => {
        let hits = 0;
        for (let seed = 1n; seed <= 8n; seed++) {
            const input = freshTurnRoom({ role: 'wizard', heroLevel: 20, moves: 5, seed });
            requirePlayingGame(game);
            game.u.uhp = game.u.uhpmax = 200;
            const jelly = await createMonsterAt('ochre jelly', 10, 10, NO_MINVENT);
            jelly.mhp = jelly.mhpmax = 500;
            setHeroGrip(jelly);
            game.u.uswallow = 1;
            game.u.ux = jelly.mx;
            installPagerInput(input, { expected: /jelly|hit|miss|bash|bare|debris|pummeled|slime|burns|appears|close by|dies|died/i, limit: 8 });
            initRng(seed);
            input.feed(keys);
            await moveloop_core();
            await finishAtCommandInput(input, moveloop_core, /jelly|appears close by|^$/);
            assert.equal(game.moves, 6, 'seed ' + seed + ': only the swallowed attack itself takes a turn');
            assert.equal(game.multi, 0, 'seed ' + seed + ': the remaining repeats are canceled');
            assert.equal(game._runState, null, 'seed ' + seed + ': no rush survives the swallowed attack');
            if (jelly.mhp < 500)
                hits++;
        }
        assert.ok(hits > 0, 'At least one seed landed the swallowed attack');
    });
}
//# sourceMappingURL=swallowed_attack_repeats.test.js.map