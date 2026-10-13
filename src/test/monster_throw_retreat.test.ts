import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { beginMonsterHeroAttack } from '../js/monmove.js';
import { CROSSBOW, CROSSBOW_BOLT } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an archer judges a retreating displaced hero by the apparent target range', async () => {
    freshObjectRoom({ left: 2, right: 20, heroX: 12, heroY: 10 });
    requirePlayingGame(game);
    game.u.ux0 = 11;
    game.u.uy0 = 10;
    game.u.displaced = true;
    const archer = await createMonsterAt('mountain centaur', 6, 10, NO_MINVENT | MM_ANGRY);
    await equipMonsterObject(archer, await knownObject(CROSSBOW), W_WEP);
    const bolts = await equipMonsterObject(archer, await knownObject(CROSSBOW_BOLT, { quan: 5 }), 0);
    archer.mux = 10;
    archer.muy = 10;
    pushKeys(' '.repeat(8));

    await beginMonsterHeroAttack(archer, game, bound => 2 % bound,
        () => 1, (count, sides) => count * sides, []);

    assert.equal(bolts.quan, 5, 'the archer should chase rather than fire at this range');
    assert.doesNotMatch(game._pending_message, /shoots|throws/);
});
