import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { requireScreenRow } from './support/screen.js';
// C do.c:1541-1573: while the hero carries the Amulet of Yendor, a Gehennom
// ascent below the top of the branch can be diverted by a mysterious force.
// The hero is sent to a deeper level of the same branch (or, when the descent
// draw stays put, teleported on the spot) instead of the stairway above.
function enterGehennomAscent() {
    const { source, destination } = freshConnectedLevels({ role: 'valkyrie' });
    requirePlayingGame(game);
    const gehennom = game.dungeons[0];
    assert.ok(gehennom, 'The connected pair owns a dungeon');
    gehennom.dname = 'Gehennom';
    gehennom.num_dunlevs = 20;
    gehennom.flags.hellish = true;
    // Stand on level 2's up stairway; level 1 becomes the cached level above.
    const cache = game._levelCache;
    assert.ok(cache);
    const upper = cache.get('0:2');
    assert.ok(upper?.stairs);
    game.level = destination;
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.stairs = upper.stairs;
    cache.delete('0:2');
    cache.set('0:1', {
        level: source,
        stairs: {
            sx: 10, sy: 10, up: false, isladder: false, u_traversed: false,
            tolev: { dnum: 0, dlevel: 2 }, next: null,
        },
        heroTrack: [], savedAt: game.moves ?? 0, activeSpecialLevel: null,
    });
    game.u.ux = 12;
    game.u.uy = 10;
    game.u.uhave = { ...game.u.uhave, amulet: 1 };
    return { source, destination };
}
// Acknowledge every message page and record each visible topline, so the
// prose the player actually saw can be checked without assuming anything
// about the random-call order inside the climb.
function recordingPager(limit) {
    const seen = [];
    const input = resetInputState();
    let keys = 0;
    input.display = {
        async readKey() {
            const line = requireScreenRow(0).map(cell => cell.ch).join('');
            if (game._pending_message)
                seen.push(game._pending_message);
            if (line)
                seen.push(line);
            if (/--More--|Hit space to continue/.test(line))
                return ' '.charCodeAt(0);
            assert.ok(++keys <= limit, `The climb kept asking for input: ${line || game._pending_message}`);
            return 27; // leave the command loop once the turn is done
        },
    };
    return { seen, input };
}
void test('the Amulet mysterious force diverts a Gehennom ascent to a deeper level', async () => {
    // The force is probabilistic, so scan a few seeds and keep the first run
    // where it observably fired; only player-visible outcomes are asserted.
    let diverted = false;
    for (let seed = 1n; seed <= 24n && !diverted; seed++) {
        enterGehennomAscent();
        const { seen } = recordingPager(60);
        initRng(seed);
        await rhack('<'.charCodeAt(0));
        // The turn may end without any pager prompt; the topline the player
        // last saw still counts as shown prose.
        seen.push(game._lastPlineMessage || '');
        const depth = game.u.uz?.dlevel ?? 0;
        if (depth > 2 && seen.some(line => /A mysterious force momentarily surrounds you\.\.\./.test(line))) {
            diverted = true;
            assert.equal(game.u.uz?.dnum, 0, 'the hero stays inside Gehennom');
            assert.ok(depth > 2, `the hero was sent below the departed level (${depth}), not up to level 1`);
        }
    }
    assert.ok(diverted, 'the mysterious force diverted at least one ascent');
});
void test('a mysterious force with no descent left keeps the hero on the level', async () => {
    let held = false;
    for (let seed = 1n; seed <= 80n && !held; seed++) {
        const { destination } = enterGehennomAscent();
        const { seen } = recordingPager(8);
        initRng(seed);
        await rhack('<'.charCodeAt(0));
        // The same-level rescue pages nothing; the last shown topline is
        // the player-visible prose for it.
        seen.push(game._lastPlineMessage || '');
        const moved = game.u.ux !== 12 || game.u.uy !== 10;
        if (game.level === destination && game.u.uz?.dlevel === 2 && moved
            && seen.some(line => /A mysterious force momentarily surrounds you\.\.\./.test(line))) {
            held = true;
            assert.equal(game.u.uz.dnum, 0);
            assert.ok(game.u.utrap === undefined || game.u.utrap === 0, 'the same-level rescue leaves no trap behind');
        }
    }
    assert.ok(held, 'the mysterious force held the hero on the level and teleported them at least once');
});
//# sourceMappingURL=amulet_mysterious_force.test.js.map