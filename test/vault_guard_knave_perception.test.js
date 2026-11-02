import test from 'node:test';
import assert from 'node:assert/strict';
import { runMonsterAction } from '../js/monmove.js';
import { ROOM, ROOMOFFSET, VAULT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createRoom } from './support/topology.js';
import { flushPendingTopline } from '../js/tty_topline.js';
// monmove.c:m_move() refreshes the actor's apparent hero position exactly
// once (set_apparxy(), monmove.c:1761) before dispatching to shk_move(),
// gd_move(), or pri_move().  When gd_move() returns -1 (monmove.c:1812),
// m_move() continues into ordinary monster movement with the mux/muy that
// gd_move()'s own mnexto() -> rloc_to() refresh left behind
// (teleport.c:1702); no further set_apparxy() runs.  This test pins that
// call count for the "You've been warned, knave!" warning path
// (vault.c:961-974), which returns -1 after relocating the guard.
void test('a knave-warned guard continues m_move without another perception refresh', async () => {
    const level = await freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 14, heroX: 10, heroY: 10 });
    requirePlayingGame(game);
    // The hero stands inside a vault while carrying gold; the guard digs in
    // one square outside it, on its seventh warning.
    const vault = createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT });
    level.rooms.push(vault);
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    const guard = await createMonsterAt('guard', 12, 10);
    guard.isgd = 1;
    guard.mpeaceful = 1;
    guard.msleeping = 0;
    guard.mux = 12;
    guard.muy = 10;
    guard._egd = {
        gdlevel: { ...game.u.uz }, vault,
        gddone: 0, ogx: 12, ogy: 10, gdx: 16, gdy: 10,
        warncnt: 7, dropgoldcnt: 0, fcbeg: 0, fcend: 1,
        fakecorr: [{ x: 11, y: 10, typ: ROOM, flags: 0 }],
    };
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    // Displaced hero with a seeing guard: every set_apparxy() picks the
    // displacement branch, so each refresh is RNG-visible.
    game.u.displaced = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /knave|guard/i, limit: 6 });
    initRng(20261102n);
    enableRngLog();
    await runMonsterAction(guard, game);
    await flushPendingTopline();
    assert.match(game._lastPlineMessage ?? '', /You've been warned, knave!/);
    assert.equal(guard.mpeaceful, 0, 'the seventh warning turns the guard hostile');
    assert.ok(guard.mx !== 12 || guard.my !== 10, 'mnexto() relocates the warned guard');
    // Count perception refreshes: each displaced set_apparxy() opens with a
    // "found you" rn2(4) draw followed by displacement loop draws of rn2(5)
    // (monmove.c:2239-2251).  The enexto() candidate shuffle also rolls
    // rn2(4), but always as the next-to-last draw of a strictly decreasing
    // batch tail, followed by rn2(3), so those draws never match here.
    const log = getRngLog();
    const bursts = log.filter((entry, index) => entry.startsWith('rn2(4)=') && (log[index + 1] ?? '').startsWith('rn2(5)='));
    assert.equal(bursts.length, 3, 'exactly three perception refreshes: dochug() monmove.c:778, '
        + 'm_move() monmove.c:1761, and rloc_to() teleport.c:1702');
});
//# sourceMappingURL=vault_guard_knave_perception.test.js.map