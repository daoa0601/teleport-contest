import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_EMIN, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('ordinary Angels can be roaming minions even without inventory', async () => {
    let roamers = 0;
    let ordinary = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        requirePlayingGame(game);
        const angel = await makemonAt(MONSTER_NAME.indexOf('Angel'), 11, 10, MM_NOMSG | NO_MINVENT);
        assert.ok(angel);
        if (angel.isminion) {
            roamers++;
            assert.ok(angel.emin);
            assert.ok([-1, 0, 1].includes(angel.emin.min_align));
            const peaceful = angel.emin.min_align === game.u.ualign.type
                ? !angel.emin.renegade : angel.emin.renegade;
            assert.equal(!!angel.mpeaceful, !!peaceful);
        }
        else {
            ordinary++;
        }
    }
    assert.ok(roamers > 0, 'some ordinary Angels should have roaming-minion state');
    assert.ok(ordinary > 0, 'the remaining Angels keep their ordinary attitude');
});
void test('the caller owns an Angel minion alignment requested with MM_EMIN', async () => {
    freshObjectRoom({ gameplaySeed: 1 });
    const angel = await makemonAt(MONSTER_NAME.indexOf('Angel'), 11, 10, MM_NOMSG | NO_MINVENT | MM_EMIN);
    assert.ok(angel);
    assert.equal(!!angel.isminion, false);
});
//# sourceMappingURL=monster_birth_native_rules.test.js.map