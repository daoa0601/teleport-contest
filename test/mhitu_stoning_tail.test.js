import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// A cockatrice has a 1d3 AD_PHYS bite and one 0d0 AD_STON touch.  C
// uhitm.c:mhitm_ad_ston()'s mhitu branch draws rn2(3) before its hissing or
// grimace line and rn2(10) (or a new moon) before do_stone_u().  A
// successful do_stone_u() sets mhm.done, but mhitu.c:hitmu() calls
// mhitm_knockback() before it returns on mhm.done, so the petrifying touch
// still draws knockback's rn2(3) distance and rn2(6) chance.
void test('a stoning touch that starts petrification still rolls knockback', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cockatrice.msleeping = 0;
    cockatrice.mux = game.u.ux;
    cockatrice.muy = game.u.uy;
    const limits = [];
    const random = (limit) => {
        limits.push(limit);
        // Pass the hissing and petrification gates; knockback chance fails.
        return limit === 6 ? 1 : 0;
    };
    const input = resetInputState();
    input.feed(' '.repeat(12));
    await performMonsterHeroAttack(cockatrice, game, {
        random,
        rollOne: () => 1,
        rollDice: dice => (dice === 0 ? 0 : 1),
    });
    assert.equal(game.u.stonedTurns, 5, 'the touch starts the petrification countdown');
    const stoneGate = limits.lastIndexOf(10);
    assert.ok(stoneGate > 0, `the touch draws its petrification gate: ${limits.join(',')}`);
    assert.deepEqual(limits.slice(stoneGate + 1, stoneGate + 3), [3, 6], `knockback's distance and chance follow the petrifying touch: ${limits.join(',')}`);
});
//# sourceMappingURL=mhitu_stoning_tail.test.js.map