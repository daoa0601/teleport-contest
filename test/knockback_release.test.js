import test from 'node:test';
import assert from 'node:assert/strict';
// C uhitm.c:mhitm_knockback() releases a held hero through unstuck(), which
// gives a holding monster a short cooldown before it can grab again.
import { NO_MINVENT, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { tryKnockback } from '../js/knockback.js';
import { AD_PHYS, AT_WEAP } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('knocking a held hero free gives the holder its re-hold cooldown', async () => {
    freshObjectRoom({ heroX: 12, right: 20, flags: { verbose: false } });
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const giant = await createMonsterAt('hill giant', ux - 1, uy, NO_MINVENT);
    const owlbear = await createMonsterAt('owlbear', ux, uy + 1, NO_MINVENT);
    owlbear.mspec_used = 0;
    game.u.ustuck = owlbear;
    pushKeys(' '.repeat(20));
    const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
    });
    assert.equal(result.knocked, true);
    assert.equal(game.u.ustuck, null);
    assert.ok(game.u.ux > ux, 'The hero is knocked away from the giant');
    assert.ok(owlbear.mspec_used >= 1 && owlbear.mspec_used <= 2);
});
// C mhitm_knockback() hurtles the hero before its 1-in-4 stun roll; a fatal
// wall bump ends the game inside hurtle(), so no stagger follows the death.
void test('a fatal knockback into a wall ends the game before the stun roll', async () => {
    const level = freshObjectRoom({ heroX: 12, right: 20, flags: { verbose: false } });
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux + 2, uy).typ = STONE;
    game.u.uhp = 1;
    const giant = await createMonsterAt('hill giant', ux - 1, uy, NO_MINVENT);
    const messages = [];
    pushKeys('n'.repeat(10) + ' '.repeat(40));
    const result = await tryKnockback(giant, game.u, { attackType: AT_WEAP, damageType: AD_PHYS }, {
        random: () => 0,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(result.knocked, true);
    assert.equal(result.defenderDied, true, 'callers learn the hero died');
    assert.equal(!!game.program_state.gameover, true, 'the wall bump is fatal');
    assert.equal(!!game.u.stunned || (game.u.stunnedTurns ?? 0) > 0, false);
    assert.equal(messages.some(message => /stagger/i.test(message)), false);
});
//# sourceMappingURL=knockback_release.test.js.map