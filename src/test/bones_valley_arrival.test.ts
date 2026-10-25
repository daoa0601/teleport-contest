import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { saveBonesLevel } from '../js/mklev.js';
import { InMemoryStorage } from '../js/storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { memoryStorage } from './support/memory-storage.js';

function gehennomGames(storage: InMemoryStorage, heroDepth: {
    dnum: number; dlevel: number;
}): void {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: heroDepth }, seed: 3n });
    game.plname = 'player';
    game.storage = storage;
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 5, bonetag: 'G', flags: { hellish: true } }),
    ];
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
}

// C do.c:goto_level() delivers the Valley lines (do.c:1859-1864), then
// familiar_level_msg() (do.c:1875); only the "You materialize" line goes
// earlier (maybe_lvltport_feedback(), do.c:2031).  A deferred message such
// as the throne's follows after goto_level() returns (deferred_goto(),
// do.c:2096).  A bones level runs the same arrival block as any other.
void test('a deferred arrival message into a bones Valley prints once, after the Valley and deja-vu lines', async () => {
    const storage = memoryStorage();
    gehennomGames(storage, { dnum: 1, dlevel: 1 });
    assert.equal(saveBonesLevel(), true, 'the setup must record bones in the Valley');

    gehennomGames(storage, { dnum: 0, dlevel: 1 });
    const seen: string[] = [];
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        reads += 1;
        seen.push(game._pending_message || game._retained_message || '');
        // The bones prompts answer y; paged arrival lines take a space.
        input.feed(reads <= 2 ? 'y' : ' ');
    };

    await gotoLevel(
        { dnum: 1, dlevel: 1 },
        { postMessage: 'You feel extremely out of place.' },
    );
    seen.push(game._pending_message || '');

    const lines = seen.join('\n');
    const deferred = lines.split('You feel extremely out of place.').length - 1;
    assert.equal(deferred, 1,
        'the deferred arrival message must print exactly once on a bones level');
    const valley = lines.indexOf('You arrive at the Valley of the Dead...');
    const dejaVu = lines.search(/deja vu|been here before|familiar\.\.\./);
    const after = lines.indexOf('You feel extremely out of place.');
    assert.ok(valley >= 0, 'the Valley lines must print on the bones Valley arrival');
    assert.ok(dejaVu >= 0, 'the bones deja-vu line must print');
    assert.ok(valley < dejaVu,
        'the Valley announcement precedes the deja-vu line (do.c:1859-1875)');
    assert.ok(dejaVu < after,
        'the deferred message follows the arrival lines (deferred_goto(), do.c:2096)');
});

// C do.c:goto_level() calls maybe_lvltport_feedback() (do.c:1854) on every
// arrival, so the level-teleport line precedes the Valley and deja-vu lines
// even when no glowing Sting delivered it during docrt().
void test('a level teleport into a bones Valley announces the materialization first', async () => {
    const storage = memoryStorage();
    gehennomGames(storage, { dnum: 1, dlevel: 1 });
    assert.equal(saveBonesLevel(), true, 'the setup must record bones in the Valley');

    gehennomGames(storage, { dnum: 0, dlevel: 1 });
    const seen: string[] = [];
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        reads += 1;
        seen.push(game._pending_message || game._retained_message || '');
        input.feed(reads <= 2 ? 'y' : ' ');
    };

    await gotoLevel(
        { dnum: 1, dlevel: 1 },
        { arrival: 'random', postMessage: 'You materialize on a different level!' },
    );
    seen.push(game._pending_message || '');

    const lines = seen.join('\n');
    const materialize = lines.indexOf('You materialize on a different level!');
    const valley = lines.indexOf('You arrive at the Valley of the Dead...');
    assert.ok(materialize >= 0, 'the level-teleport line must print on a bones arrival');
    assert.equal(lines.split('You materialize on a different level!').length - 1, 1,
        'the level-teleport line prints once');
    assert.ok(materialize < valley,
        'the level-teleport line precedes the Valley announcement (do.c:1854)');
});
