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
function gehennomGames(storage, heroDepth) {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: heroDepth }, seed: 3n });
    game.plname = 'player';
    game.storage = storage;
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 5, bonetag: 'G', flags: { hellish: true } }),
    ];
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
}
// C do.c:goto_level() prints the deferred arrival message once, then the
// Valley lines (do.c:1859-1864), then familiar_level_msg() (do.c:1875).
// A bones level runs the same arrival block as any other level.
void test('a deferred arrival message into a bones Valley prints once, before the Valley and deja-vu lines', async () => {
    const storage = memoryStorage();
    gehennomGames(storage, { dnum: 1, dlevel: 1 });
    assert.equal(saveBonesLevel(), true, 'the setup must record bones in the Valley');
    gehennomGames(storage, { dnum: 0, dlevel: 1 });
    const seen = [];
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        reads += 1;
        seen.push(game._pending_message || game._retained_message || '');
        // The bones prompts answer y; paged arrival lines take a space.
        input.feed(reads <= 2 ? 'y' : ' ');
    };
    await gotoLevel({ dnum: 1, dlevel: 1 }, { postMessage: 'You feel extremely out of place.' });
    seen.push(game._pending_message || '');
    const lines = seen.join('\n');
    const deferred = lines.split('You feel extremely out of place.').length - 1;
    assert.equal(deferred, 1, 'the deferred arrival message must print exactly once on a bones level');
    const valley = lines.indexOf('You arrive at the Valley of the Dead...');
    const dejaVu = lines.search(/deja vu|been here before|familiar\.\.\./);
    assert.ok(valley >= 0, 'the Valley lines must print on the bones Valley arrival');
    assert.ok(dejaVu >= 0, 'the bones deja-vu line must print');
    assert.ok(valley < dejaVu, 'the Valley announcement precedes the deja-vu line (do.c:1859-1875)');
});
//# sourceMappingURL=bones_valley_arrival.test.js.map