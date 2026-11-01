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
// grimace line and rn2(10) (or a new moon) before do_stone_u(); a successful
// do_stone_u() sets mhm.done, so mhitu.c:hitmu() returns before
// mhitm_knockback() and its two chance draws.  The next attack's stoning
// gate therefore draws rn2(3) immediately after the petrifying touch's
// rn2(10): with the shared dice script below, the second attack's touch
// draws the script value that a knockback pair would otherwise have
// consumed, hisses again, and cannot start a second countdown.
void test('a stoning touch that starts petrification ends its slot before knockback', async () => {
    await freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const cockatrice = await createMonsterAt('cockatrice', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    cockatrice.msleeping = 0;
    cockatrice.mux = game.u.ux;
    cockatrice.muy = game.u.uy;
    const rolls = [1, 1, 0, 0, 1, 1, 0, 1, 1];
    let rollIndex = 0;
    const stoningDice = (limit) => {
        const value = rolls[rollIndex++] ?? 1;
        assert.ok(value < limit, `the scripted die must stay below rn2(${limit})`);
        return value;
    };
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(12));
    const runAttack = async (attacker) => {
        requirePlayingGame(game);
        await performMonsterHeroAttack(attacker, game, {
            random: stoningDice,
            rollOne: () => 1,
            rollDice: dice => (dice === 0 ? 0 : 1),
        });
    };
    await runAttack(cockatrice);
    await runAttack(cockatrice);
    const prose = `${messages.join('\n')}\n${game._pending_message ?? ''}`;
    const hissings = prose.match(/hissing!/g) ?? [];
    assert.equal(hissings.length, 2, `each attack's touch hisses under its own one-in-three gate\n${prose}`);
    assert.equal(game.u.stonedTurns, 5, 'only the first petrifying touch starts the countdown');
    assert.equal(game.u.uhp, 98, 'each attack costs only its bite damage');
});
//# sourceMappingURL=mhitu_stoning_tail.test.js.map