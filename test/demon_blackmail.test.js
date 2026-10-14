import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction, resumeDeferredCovetousRelocation } from '../js/monmove.js';
import { pushKeys } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a peaceful invisible demon prince reveals itself and attacks a penniless hero', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const prince = await createMonsterAt('Baalzebub', 11, 10, NO_MINVENT);
    prince.msleeping = 0;
    assert.equal(!!prince.mpeaceful, true);
    assert.equal(!!prince.minvis, true);
    pushKeys(' '.repeat(20));
    const action = await runMonsterAction(prince, game);
    if (action.movement?.deferredCovetousRelocation)
        await resumeDeferredCovetousRelocation(action, game);
    assert.equal(!!prince.minvis, false, 'the prince reveals itself before asking for payment');
    assert.equal(!!prince.perminvis, false);
    assert.equal(!!prince.mpeaceful, false, 'a hero without spendable gold cannot buy safe passage');
});
//# sourceMappingURL=demon_blackmail.test.js.map