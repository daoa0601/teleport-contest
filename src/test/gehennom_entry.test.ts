import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { LA_UP, STAIRS } from '../js/const.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createRoomLevel } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';

// C do.c:1874-1876 (goto_level): any arrival in Gehennom that bypassed the
// Valley's stairway down sets u.uevent.gehennom_entered, so dodown()'s gate
// prompt (do.c:1242-1248) cannot ask again afterwards.  The Valley itself is
// the gate, so arriving there leaves the event unset.
function gehennomLevels(): void {
    freshConnectedLevels();
    const cache = game._levelCache;
    assert.ok(cache);
    cache.delete('0:2');
    game.dungeons.push(createDungeon({
        dname: 'Gehennom', depth_start: 29, num_dunlevs: 3, dunlev_ureached: 0,
        flags: { hellish: true },
    }));
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    for (const dlevel of [1, 2]) {
        const level = createRoomLevel();
        const square = level.at(12, 10);
        if (!square) throw new Error('Gehennom arrival level needs its stair square');
        square.typ = STAIRS;
        square.ladder = LA_UP;
        level.upstair = { x: 12, y: 10 };
        cache.set(`1:${dlevel}`, {
            level,
            stairs: { sx: 12, sy: 10, up: true, isladder: false, u_traversed: false,
                tolev: { dnum: 0, dlevel: 1 }, next: null },
            heroTrack: [], savedAt: game.moves, activeSpecialLevel: null,
        });
    }
}

void test('entering Gehennom past the Valley marks Gehennom entered', async () => {
    gehennomLevels();
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'random' });

    assert.equal(game.u.uevent?.gehennom_entered ?? 0, 0,
        'arriving on the Valley is standing at the gate, not past it (Is_valley, do.c:1875)');

    await gotoLevel({ dnum: 1, dlevel: 2 }, { arrival: 'random' });

    assert.equal(game.u.uevent?.gehennom_entered ?? 0, 1,
        'a Gehennom level beyond the Valley sets the event (do.c:1876)');
});

void test('the Valley gate stays silent after Gehennom was entered', async () => {
    gehennomLevels();
    // The Valley's own stairway down to the rest of Gehennom.
    const valley = game._levelCache?.get('1:1');
    assert.ok(valley);
    const downSquare = valley.level.at(14, 10);
    if (!downSquare) throw new Error('The Valley needs its down stair square');
    downSquare.typ = STAIRS;
    const valleyStairs = valley.stairs;
    if (!valleyStairs) throw new Error('The Valley needs its return stairway');
    valleyStairs.next = { sx: 14, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 1, dlevel: 2 }, next: null };
    const input = resetInputState();
    const pages: string[] = [];
    installPagerInput(input, {
        expected: /climb up the stairs|descend the stairs/,
        limit: 2,
        pages,
    });

    // A level teleport lands beyond the Valley first (the bypass), then the
    // hero walks back up to the Valley's stairway down.
    await gotoLevel({ dnum: 1, dlevel: 2 }, { arrival: 'random' });
    await gotoLevel({ dnum: 1, dlevel: 1 }, { arrival: 'stairs' });
    assert.equal(game.u.uevent?.gehennom_entered ?? 0, 1,
        'the bypassed arrival still marks Gehennom entered');
    assert.deepEqual(game.u.uz, { dnum: 1, dlevel: 1 },
        'the stairway arrival returns the hero to the Valley');
    assert.ok(game.u.ux === 14 && game.u.uy === 10,
        'the hero waits on the Valley stairway down');

    await rhack('>'.charCodeAt(0));

    const shown = pages.join('\n');
    assert.doesNotMatch(shown, /gate to Gehennom|Are you sure you want to enter/,
        'dodown() skips the gate once gehennom_entered is set (do.c:1242)');
    assert.match(shown, /You descend the stairs\./,
        'the descent itself still announces (do.c:1800)');
    assert.deepEqual(game.u.uz, { dnum: 1, dlevel: 2 });
    assert.equal(game.context.move, 1);
});
