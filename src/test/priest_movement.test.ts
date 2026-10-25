import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { ALTAR, AM_SHRINE, Align2amask, NO_MINVENT, ROOMOFFSET, TEMPLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';

async function templeWithResident(priestX: number, priestY: number, hostile: boolean) {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.flags.rndmongen = false;
    const room = createRoom({ lx: 11, hx: 16, ly: 6, hy: 14, rtype: TEMPLE });
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++) level.requireAt(x, y).roomno = ROOMOFFSET;
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_SHRINE | Align2amask(0);
    const priest = await createMonsterAt('aligned cleric', priestX, priestY, NO_MINVENT);
    priest.ispriest = 1;
    priest.mpeaceful = hostile ? 0 : 1;
    priest.msleeping = 0;
    priest.mcanmove = 1;
    priest.epri = {
        shroom: ROOMOFFSET, shralign: 0, shrpos: { x: 12, y: 10 },
        shrlevel: { ...game.u.uz }, parentmid: priest.m_id,
        intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
    };
    const input = resetInputState();
    // Answer pager boundaries with space and cancel any other read.
    input.display = {
        async readKey() {
            const screen = (game.nhDisplay?.grid ?? []).map(row => row.map(cell => cell.ch).join('')).join('\n');
            return /--More--|Hit space/.test(screen) ? 32 : 27;
        },
    };
    initRng(7);
    game.u.ux = 15;
    game.u.uy = 13;
    game.u.urooms = [ROOMOFFSET];
    game.u.urooms0 = [ROOMOFFSET];
    game._moveloopStarted = true;
    game.u.uhp = game.u.uhpmax = 40;
    return { level, room, priest };
}

async function residentTurn(priest: { movement?: number }) {
    priest.movement = 12;
    game._heroTimePending = true;
    game.u.umovement = 12;
    await moveloop_core();
}

// C priest.c:pri_move(): a resident keeps guarding its own temple, milling
// around the altar square rather than wandering off or stepping on the hero.
void test('a peaceful resident mills beside its altar and stays inside the temple', async () => {
    const { room, priest } = await templeWithResident(14, 8, false);

    for (let turn = 0; turn < 16; turn++) {
        await residentTurn(priest);
        assert.ok(priest.mx >= room.lx && priest.mx <= room.hx && priest.my >= room.ly && priest.my <= room.hy,
            `turn ${turn}: priest left the temple at <${priest.mx},${priest.my}>`);
        assert.ok(priest.mx !== game.u.ux || priest.my !== game.u.uy,
            `turn ${turn}: priest stepped onto the hero`);
    }

    const altarDistance = Math.max(Math.abs(priest.mx - 12), Math.abs(priest.my - 10));
    assert.ok(altarDistance <= 2, `priest settled ${altarDistance} squares from its altar`);
    assert.equal(priest.mpeaceful, 1);
});

// C priest.c:pri_move(): an angry resident inside the temple hunts the hero
// instead of milling, closing in and striking with its clerical arsenal.
void test('an angry resident hunts down and attacks the hero inside its temple', async () => {
    const { priest } = await templeWithResident(14, 8, true);

    let hunted = false;
    for (let turn = 0; turn < 6 && !hunted; turn++) {
        await residentTurn(priest);
        const adjacent = Math.max(Math.abs(priest.mx - game.u.ux), Math.abs(priest.my - game.u.uy)) <= 1;
        hunted = adjacent && (game.u.uhp ?? 40) < 40;
    }

    assert.ok(hunted, `the angry priest never attacked (at <${priest.mx},${priest.my}>, hp ${game.u.uhp})`);
    assert.ok((game.u.uhp ?? 40) < 40, 'the priest should have damaged the hero');
});
