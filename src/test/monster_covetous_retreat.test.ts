import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, STRAT_HEAL } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mkstairs } from '../js/mklev.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { retreatCovetousMonster } from '../js/monster_covetous_retreat.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const woundedHp of [85, 50]) {
    void test(`a covetous lich at ${woundedHp}/90 HP retreats before checking its attack range`, async () => {
        freshObjectRoom({ left: 8, right: 45 });
        await init_dungeons();
        requirePlayingGame(game);
        mkstairs(40, 10, true, null);
        const lich = await createMonsterAt('master lich', 11, 10, NO_MINVENT);
        lich.mhpmax = 90;
        lich.mhp = woundedHp;
        lich.mpeaceful = 0;
        lich.mcan = 1;
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');

        await takeMonsterTurn(lich, game, limit => limit - 1, undefined, sides => sides);

        assert.ok(Math.abs(lich.mx - 40) <= 1 && Math.abs(lich.my - 10) <= 1,
            `the lich should remain at the retreat stairs, found ${lich.mx},${lich.my}`);
        assert.equal(lich.mhp, woundedHp === 50 ? 58 : 85);
        assert.equal(lich.mavenge, 1);
        assert.ok((lich.mstrategy ?? 0) & STRAT_HEAL);
        assert.equal(game.u.uhp, 40);
    });
}

void test('cosmic stasis keeps a covetous retreat at its current square', async () => {
    const level = freshObjectRoom({ left: 8, right: 45 });
    await init_dungeons();
    requirePlayingGame(game);
    mkstairs(40, 10, true, null);
    level.flags.stasis_until = game.moves + 5;
    const lich = await createMonsterAt('master lich', 11, 10, NO_MINVENT);
    lich.mhpmax = 90;
    lich.mhp = 50;
    lich.mpeaceful = 0;
    lich.mcan = 1;

    await takeMonsterTurn(lich, game, limit => limit - 1);

    assert.equal(lich.mx, 11);
    assert.equal(lich.my, 10);
    assert.equal(lich.mhp, 50);
    assert.equal(lich.mavenge, 1);
});

for (const { startX, destinationX, heals } of [
    { startX: 11, destinationX: 40, heals: false },
    { startX: 40, destinationX: 11, heals: true },
]) {
    void test(`a wounded tower lich teleporting ${heals ? 'toward' : 'away from'} the hero checks its original distance before healing`, async () => {
        freshObjectRoom({ left: 8, right: 45 });
        await init_dungeons();
        requirePlayingGame(game);
        game._activeSpecialLevel = {
            prototype: 'wizard1', file: 'wizard1.lua',
            downTeleportExclude: { lx: 8, ly: 6, hx: 45, hy: 14 },
        };
        const lich = await createMonsterAt('master lich', startX, 10, NO_MINVENT);
        lich.mhpmax = 90;
        lich.mhp = 50;

        const result = await retreatCovetousMonster(lich, game,
            limit => limit === 21 ? 10 : 0,
            sides => sides === 79 ? destinationX : 5);

        assert.equal(lich.mx, destinationX);
        assert.equal(lich.my, 10);
        assert.equal(lich.mhp, heals ? 55 : 50);
        assert.equal(result, heals ? 'recovered' : 'harass');
    });
}
