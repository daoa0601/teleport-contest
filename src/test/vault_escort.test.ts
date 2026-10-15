import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CORR, ROOMOFFSET, STONE, VAULT, VWALL, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { rn2 } from '../js/rng.js';
import { moveVaultGuard } from '../js/vault.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

async function escort() {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.rndmongen = false;
    const vault = createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT });
    level.rooms = [vault];
    level.nroom = 1;
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    const guard = await createMonsterAt('guard', 11, 10, NO_MINVENT);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard.msleeping = 0;
    guard._egd = {
        gdlevel: { ...game.u.uz }, vault, gddone: 0,
        ogx: 11, ogy: 10, gdx: 16, gdy: 10, warncnt: 1, dropgoldcnt: 1,
        fcbeg: 0, fcend: 1, fakecorr: [{ x: 11, y: 10, typ: VWALL, flags: 0 }],
    };
    const input = resetInputState();
    input.beforeRead = () => {
        const top = game.nhDisplay?.grid.slice(0, 3).map(row => row.map(cell => cell.ch).join('')).join('') ?? '';
        input.feed(top.includes('--More--') ? ' ' : '.');
    };
    return { level, guard };
}

void test('a guard eventually attacks a hero who keeps the vault gold through repeated turns', async () => {
    const { guard } = await escort();
    setHeroGoldAmount(game, 50);
    game._moveloopStarted = true;
    game.u.umovement = 12;

    for (let turn = 0; turn < 10 && guard.mpeaceful; turn++) await moveloop_core();

    assert.equal(guard.mpeaceful, 0);
});

void test('an escort recovers dropped corridor gold without advancing past the hero', async () => {
    const { level, guard } = await escort();
    assert.ok(guard._egd);
    guard.mx = guard._egd.ogx = 13;
    guard._egd.fcend = 3;
    guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 }, { x: 13, y: 10, typ: STONE, flags: 0 });
    for (let x = 11; x <= 13; x++) level.requireAt(x, 10).typ = CORR;
    game.u.ux = 12;
    const coins = await floorObject(GOLD_PIECE, 12, 10, { quan: 71 });

    await moveVaultGuard(guard, game, rn2);

    assert.equal(coins.where, 'minvent');
    assert.equal(monsterGoldAmount(guard), 71);
    assert.equal(guard.mx, 13);
    assert.equal(guard._egd.warncnt, 5);
});

void test('a finished parked escort removes its corridor on a later world turn', async () => {
    const { level, guard } = await escort();
    assert.ok(guard._egd);
    guard.mx = guard.my = 0;
    guard._egd.ogx = guard._egd.ogy = 0;
    guard._egd.gddone = 1;
    guard._egd.fcend = 2;
    guard._egd.fakecorr.push({ x: 12, y: 10, typ: STONE, flags: 0 });
    level.requireAt(12, 10).typ = CORR;
    game.u.ux = 14;
    game._moveloopStarted = true;
    game.u.umovement = 12;

    await moveloop_core();
    await moveloop_core();

    assert.equal(level.monsters.includes(guard), false);
    assert.equal(level.requireAt(12, 10).typ, STONE);
});
