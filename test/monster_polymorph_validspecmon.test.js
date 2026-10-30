import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C mon.c:select_newcham_form()'s random fallback rejects notake and headless
// forms for shopkeepers, aligned priests, vault guards, and the quest leader
// while its fifty-attempt loop still retries (validspecmon()). On the Rogue
// level those retries run for the first nine draws, so a guard polymorph
// skips a floating eye or piercer that an ordinary monster could take.
// Seed 6 draws mountain nymph, werejackal, freezing sphere, pyrolisk, guard,
// straw golem, gas spore, cockatrice, hobbit, then salamander: the first
// five are lower case (newcham()'s first five attempts demand upper case),
// gas spore has no head and is retried, and the guard becomes the
// salamander, not the cockatrice an unrestricted selection would return.
void test('a polymorphed vault guard on the Rogue level keeps a usable body', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const guard = await createMonsterAt('guard', 12, 10, NO_MINVENT);
    guard.isgd = 1;
    game.rogue_level = { dnum: game.u.uz.dnum, dlevel: game.u.uz.dlevel };
    initRng(6n);
    const change = await changeMonsterForm(guard, null, game, {
        publish: async () => { },
    });
    assert.ok(change, 'the polymorph succeeds');
    assert.equal(MONSTER_NAME[guard.mnum ?? -1], 'salamander', 'the headless gas spore draw is retried like C validspecmon()');
});
//# sourceMappingURL=monster_polymorph_validspecmon.test.js.map