import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng, rnd, rn2 } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPagerInput } from './support/pager-input.js';
import type { GameMap } from '../js/game.js';
import type { CachedLevelState } from '../js/map_types.js';

// C do.c:1541-1573: while the hero carries the Amulet of Yendor, a Gehennom
// ascent below the top of the branch can be diverted by a mysterious force.
// The hero is sent to a deeper level of the same branch (or, with no room
// for a descent draw, teleported on the spot) instead of the stairway above.

function enterGehennomAscent(): { source: GameMap; destination: GameMap } {
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
    } satisfies CachedLevelState);
    game.u.ux = 12;
    game.u.uy = 10;
    game.u.uhave = { ...game.u.uhave, amulet: 1 };
    return { source, destination };
}

void test('the Amulet mysterious force diverts a Gehennom ascent to a deeper level', async () => {
    enterGehennomAscent();
    // The climb consumes rn2(4 + 0) for the force and rn2(odds) for the
    // descent distance; replay both to learn the diverted level, then run
    // the same stream through the real '<' command.
    const heroAlignment = game.u.ualign;
    assert.ok(heroAlignment, 'The playing hero has an alignment');
    const odds = 3 + heroAlignment.type;
    let seed = 1n;
    let diverted = 0;
    for (;; seed++) {
        initRng(seed);
        if (rn2(4) === 0) {
            const diff = rn2(odds);
            if (diff > 0) {
                diverted = Math.max(1, Math.min(20, 2 + rnd(diff)));
                break;
            }
        }
    }
    assert.ok(diverted > 2, 'the seed search must find a genuine descent');

    installPagerInput(resetInputState(), {
        // A freshly generated Gehennom level may page through its own
        // arrival prose and monster turns; the diverted depth is the
        // observable under test.
        expected: /[\s\S]*/,
        limit: 40,
    });
    initRng(seed);
    await rhack('<'.charCodeAt(0));


    const depth = game.u.uz;
    assert.ok(depth, 'The hero keeps a dungeon location');
    assert.equal(depth.dnum, 0);
    assert.equal(depth.dlevel, diverted,
        'the ascent was diverted to a deeper Gehennom level');
    assert.ok(depth.dlevel > 2, 'the hero never reached the stairway above');
});

void test('a mysterious force with no descent left keeps the hero on the level', async () => {
    const { destination } = enterGehennomAscent();
    // rn2(4 + 0) == 0 followed by rn2(odds) == 0: the force fires but the
    // descent draw stays put, so the hero is teleported on the same level.
    const heroAlignment = game.u.ualign;
    assert.ok(heroAlignment, 'The playing hero has an alignment');
    const odds = 3 + heroAlignment.type;
    let seed = 1n;
    for (;; seed++) {
        initRng(seed);
        if (rn2(4) === 0 && rn2(odds) === 0) break;
    }

    installPagerInput(resetInputState(), { expected: /[\s\S]*/, limit: 8 });
    initRng(seed);
    await rhack('<'.charCodeAt(0));

    assert.ok(game.level === destination, 'the hero never left the level');
    assert.equal(game.u.uz?.dnum, 0);
    assert.equal(game.u.uz?.dlevel, 2);
    assert.match(game._pending_message || '',
        /A mysterious force momentarily surrounds you\.\.\./);
});
