import test from 'node:test';
import assert from 'node:assert/strict';

// C uhitm.c:mhitm_knockback() releases a held hero through unstuck(), which
// gives a holding monster a short cooldown before it can grab again.

import { NO_MINVENT } from '../js/const.js';
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
