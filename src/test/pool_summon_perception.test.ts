import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { msummon, summonMinion } from '../js/minion.js';
import { summonNastyMonsters } from '../js/mklev.js';

void test('a demon summon knows the hero position at birth', async () => {
    freshObjectRoom();
    const devil = await createMonsterAt('bone devil', 13, 10, NO_MINVENT);

    const summoned = await msummon(devil);

    assert.equal(summoned.created.length, 1);
    const skeleton = summoned.created[0];
    assert.ok(skeleton);
    assert.equal(skeleton.mux, game.u.ux);
    assert.equal(skeleton.muy, game.u.uy);
});

void test('a divine minion knows the hero position at birth', async () => {
    freshObjectRoom();

    const minion = await summonMinion(0);

    assert.ok(minion);
    assert.equal(minion.mux, game.u.ux);
    assert.equal(minion.muy, game.u.uy);
});

void test('a monster spell creates nasties without knowledge of the hero position', async () => {
    freshObjectRoom({ right: 40 });
    const lich = await createMonsterAt('master lich', 30, 10, NO_MINVENT);
    lich.mux = game.u.ux;
    lich.muy = game.u.uy;

    const summons = await summonNastyMonsters(lich);

    assert.ok(summons.created.length > 0);
    for (const monster of summons.created) {
        assert.equal(monster.mux, 0, 'A preselected nearby square does not reveal the hero');
        assert.equal(monster.muy, 0);
    }
});
