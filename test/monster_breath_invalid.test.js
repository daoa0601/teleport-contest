import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS, AT_BREA } from '../js/monster_attack_types.js';
import { resolveMonsterBreathAtHero } from '../js/mthrowu.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// C mthrowu.c:1116-1117: breamm() validates the breath type after the
// lined-up, mcan, seen-resistance and recharge gates, reports the bad type
// through impossible() and never launches dobuzz(), nomul(0) or the
// recharge tail.
void test('invalid hero-directed breath reports the bad type without launching a ray', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10, MM_ANGRY | NO_MINVENT);
    dragon.mux = game.u.ux;
    dragon.muy = game.u.uy;
    game.multi = 7;
    const health = game.u.uhp;
    const cooldown = dragon.mspec_used;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    // The C breammu() call with an out-of-range damage type; rn2(3) rolls
    // one so the recharge gate lets the invalid type through.
    await resolveMonsterBreathAtHero(dragon, [AT_BREA, AD_PHYS, 0, 0], {
        state: game,
        random: () => 1,
        rollDice: () => 1,
        rollOne: () => 1,
        publish: async (message) => { messages.push(message); },
    });
    messages.push(game._pending_message);
    assert.ok(messages.some(message => message.includes('Breath weapon -1 used')), `Expected the invalid breath diagnostic; received: ${messages.join(' | ')}`);
    assert.equal(messages.some(message => message.includes(' breathes ')), false);
    assert.equal(game.u.uhp, health);
    assert.equal(game.multi, 7);
    assert.equal(dragon.mspec_used, cooldown);
});
//# sourceMappingURL=monster_breath_invalid.test.js.map