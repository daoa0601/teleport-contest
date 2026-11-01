import test from 'node:test';
import assert from 'node:assert/strict';
// C dothrow.c:throwit() recoils a levitating thrower after bhit()
// (dothrow.c:1682). A fatal hurtle ends in done(), which never returns, so
// throwit()'s tail never runs: no throwit_mon_hit(), no breakmsg()/breakobj()
// impact, and the missile is never placed at its landing square. The only
// text left on the terminal is the death ending's own pages.
import { STONE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { POT_EXTRA_HEALING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { throwInventoryObject } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
function screenText() {
    return requireGameDisplay(game).grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('a thrower killed by the recoil never lands or breaks the missile', async () => {
    const level = await freshObjectRoom({
        hero: { uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    // Throwing west recoils the floating hero east into solid rock.
    level.requireAt(11, 10).typ = STONE;
    grantIntrinsicProperty('levitation', 'outside');
    const potion = await addInventoryObject(POT_EXTRA_HEALING);
    initRng(1n);
    await throwInventoryObject(potion, 'h', Array.from({ length: 100 }, () => ' '));
    assert.equal(game.program_state.gameover, true);
    assert.match(loadScoreRecords()[0]?.death ?? '', /^killed by bumping into a wall\b/);
    const transcript = [...game._messageHistory, game._pending_message].join('\n');
    assert.match(transcript, /You float in the opposite direction\./);
    const screen = screenText();
    assert.doesNotMatch(screen, /shatters/, 'the potion never breaks after the fatal bump');
    assert.doesNotMatch(screen, /peculiar odor/, 'no vapor escapes after the fatal bump');
});
//# sourceMappingURL=throw_recoil_death.test.js.map