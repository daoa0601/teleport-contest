import test from 'node:test';
import assert from 'node:assert/strict';
import { runMonsterAction } from '../js/monmove.js';
import { ROOM, ROOMOFFSET, VAULT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng, rn2 } from '../js/rng.js';
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
// (teleport.c:1702); no further set_apparxy() runs, so the guard keeps
// believing the hero stands on the square that relocation refresh chose.
// This pins that belief for the "You've been warned, knave!" warning path
// (vault.c:961-974), which returns -1 after relocating the guard.
void test('a knave-warned guard keeps the hero position its relocation refresh chose', async () => {
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
    // Sleepers occupy every square next to the hero, so the warning
    // relocation drops the guard two squares away.  From there its
    // candidate scan cannot include the hero's square, which would pin
    // mux/muy to the hero outright (mon.c:2287-2292 "it found you,
    // displaced or no") and hide the belief the relocation refresh left.
    const deltas = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (const [dx, dy] of deltas) {
        const sleeper = await createMonsterAt('gnome', game.u.ux + dx, game.u.uy + dy);
        sleeper.msleeping = 1;
    }
    // A displaced hero with a seeing guard: every set_apparxy() takes the
    // displacement branch (monmove.c:2239-2251), so each refresh picks its
    // remembered square from scripted loop draws instead of the hero's
    // actual position.
    game.u.displaced = true;
    // Script the displacement loop draws.  Refresh 1 (dochug(),
    // monmove.c:778) and refresh 2 (m_move(), monmove.c:1761) remember the
    // square diagonally beside the hero; refresh 3 — the rloc_to() inside
    // gd_move()'s mnexto() — re-points that belief one step past the hero,
    // to (11,11).  A fourth refresh would re-roll the belief back to the
    // diagonal square.  The displacement offset is 2, so draw value v
    // targets hero - 2 + v.
    let awaitDisplacementX = false;
    let displacementPairs = 0;
    const scripted = (limit) => {
        if (limit === 4) {
            awaitDisplacementX = true;
            return 1; // "found you" always fails; the loop draws follow
        }
        if (limit === 5) {
            if (awaitDisplacementX) {
                awaitDisplacementX = false;
                displacementPairs++;
            }
            return displacementPairs === 3 ? 3 : 1;
        }
        awaitDisplacementX = false;
        return rn2(limit);
    };
    const pages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /knave|guard|gnome|kill/i, limit: 12, pages });
    initRng(20261102n);
    await runMonsterAction(guard, game, scripted);
    await flushPendingTopline();
    assert.match(pages.join('\n'), /You've been warned, knave!/);
    assert.equal(guard.mpeaceful, 0, 'the seventh warning turns the guard hostile');
    assert.ok(guard.mx !== 12 || guard.my !== 10, 'mnexto() relocates the warned guard');
    assert.deepEqual([guard.mux, guard.muy], [11, 11], 'after ordinary movement continues from gd_move()\'s -1, the guard '
        + 'still believes the hero stands on (11,11), the square the '
        + 'relocation refresh chose; a further refresh would have re-rolled '
        + 'the belief to (9,9) (monmove.c:1812-1816, teleport.c:1702)');
    assert.notDeepEqual(guard.mtrack?.[0], { x: 12, y: 10 }, 'ordinary movement starts from the square mnexto() chose: m_move() '
        + 're-reads omx/omy at not_special, so the guard\'s track never records '
        + 'its pre-relocation post (monmove.c:1853-1854)');
});
//# sourceMappingURL=vault_guard_knave_perception.test.js.map