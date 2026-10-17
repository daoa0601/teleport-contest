import test from 'node:test';
import assert from 'node:assert/strict';

import { MM_ANGRY, MM_EMIN, MM_NOMSG, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makemonAt, makemonNear } from '../js/mklev.js';
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
            assert.equal(angel.emin.parentmid, angel.m_id, 'a roamer record belongs to its newborn actor');
            assert.ok([-1, 0, 1].includes(angel.emin.min_align));
            const peaceful = angel.emin.min_align === game.u.ualign.type
                ? !angel.emin.renegade : angel.emin.renegade;
            assert.equal(!!angel.mpeaceful, !!peaceful);
        } else {
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

void test('MM_ANGRY makes a roaming Angel hostile only to a co-aligned hero', async () => {
    let peaceful = 0;
    let hostile = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        requirePlayingGame(game);

        const angel = await makemonAt(MONSTER_NAME.indexOf('Angel'), 11, 10,
            MM_ANGRY | MM_NOMSG | NO_MINVENT);

        assert.ok(angel);
        if (!angel.isminion) continue;
        assert.ok(angel.emin);
        assert.equal(angel.emin.renegade, true, `an angry roamer is a renegade (seed ${seed})`);
        if (angel.emin.min_align === game.u.ualign.type) {
            assert.equal(angel.mpeaceful, 0, `co-aligned renegade (seed ${seed})`);
            hostile++;
        } else {
            assert.equal(angel.mpeaceful, 1, `differently aligned renegade (seed ${seed})`);
            peaceful++;
        }
    }
    assert.ok(peaceful > 0, 'some renegade Angels should be peaceful to a differently aligned hero');
    assert.ok(hostile > 0, 'some renegade Angels should be hostile to a co-aligned hero');
});

for (const inMklev of [false, true]) {
    void test(`a monster requested at the hero's square ${inMklev ? 'during level creation leaves its idea of the hero unset' : 'locates the hero'}`, async () => {
        freshObjectRoom({ gameplaySeed: 3 });
        requirePlayingGame(game);
        game.in_mklev = inMklev;

        const newt = await makemonNear(MONSTER_NAME.indexOf('newt'), game.u.ux, game.u.uy, MM_NOMSG | NO_MINVENT);
        game.in_mklev = false;

        assert.ok(newt);
        // C makemon() calls set_apparxy() for byyou only outside mklev.
        if (inMklev) assert.deepEqual([newt.mux ?? 0, newt.muy ?? 0], [0, 0]);
        else assert.deepEqual([newt.mux, newt.muy], [game.u.ux, game.u.uy]);
    });
}
