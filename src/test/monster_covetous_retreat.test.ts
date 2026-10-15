import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, ROOM, STRAT_HEAL } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mkstairs } from '../js/mklev.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { retreatCovetousMonster } from '../js/monster_covetous_retreat.js';
import { BOULDER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const woundedHp of [85, 50]) {
    void test(`a covetous lich at ${woundedHp}/90 HP retreats before checking its attack range`, async () => {
        freshObjectRoom({ left: 8, right: 45 });
        await init_dungeons();
        requirePlayingGame(game);
        await mkstairs(40, 10, true, null);
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
    await mkstairs(40, 10, true, null);
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

void test('wounded Juiblex swallowing the hero on its retreat stairs keeps its expulsion destination', async () => {
    freshObjectRoom();
    await init_dungeons();
    requirePlayingGame(game);
    await mkstairs(10, 10, true, null);
    const juiblex = await createMonsterAt('Juiblex', 10, 10, NO_MINVENT);
    placeMonsterAt(juiblex, game.u.ux, game.u.uy);
    juiblex.m_id = 2;
    juiblex.mhpmax = 90;
    juiblex.mhp = 50;
    game.u.uswallow = 1;
    game.u.ustuck = juiblex;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    const result = await retreatCovetousMonster(juiblex, game, () => 0, () => 1);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(juiblex.mx, 9, 'expulsion places Juiblex beside the hero without another stair relocation');
    assert.equal(juiblex.my, 9);
    assert.equal(juiblex.mhp, 50);
    assert.equal(result, 'harass');
});

void test('Juiblex returns to its pre-expulsion square when blocked stairs leave no retreat destination', async () => {
    const level = freshObjectRoom({ left: 10, right: 10, top: 10, bottom: 10 });
    await init_dungeons();
    requirePlayingGame(game);
    const expulsionSquare = level.at(9, 9);
    assert.ok(expulsionSquare);
    expulsionSquare.typ = ROOM;
    await mkstairs(40, 10, true, null, true);
    await floorObject(BOULDER, 40, 10);
    const juiblex = await createMonsterAt('Juiblex', 10, 10, NO_MINVENT);
    placeMonsterAt(juiblex, game.u.ux, game.u.uy);
    juiblex.m_id = 2;
    juiblex.mhpmax = 90;
    juiblex.mhp = 50;
    game.u.uswallow = 1;
    game.u.ustuck = juiblex;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    const result = await retreatCovetousMonster(juiblex, game, () => 0, () => 1);

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(juiblex.mx, 10, 'failed retreat must restore the position saved before expulsion');
    assert.equal(juiblex.my, 10);
    assert.equal(juiblex.mhp, 50);
    assert.equal(result, 'blocked');
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
