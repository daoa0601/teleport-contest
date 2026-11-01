import test from 'node:test';
import assert from 'node:assert/strict';

// C apply.c:3857-3859 use_grapple(): after the yank hurtle the hero gets
// spoteffects(TRUE), but a fatal hurtle ends in done(), which never returns,
// so the trap on the hero's square never fires after the death ending.

import { PIT, STONE, W_WEP } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { GRAPPLING_HOOK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('a hook yank that kills the hero never runs the landing spot effects', async () => {
    const level = await freshObjectRoom({
        hero: { uhp: 1, uhpmax: 100, urexp: 100 },
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const hook = await addInventoryObject(GRAPPLING_HOOK, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = hook;
    installHeroWeaponSkills({});
    // The hook lands two squares east; the one-square yank bumps the hero
    // into solid rock, and the pit under the hero is what spoteffects(TRUE)
    // would fire were the hero still alive.
    level.requireAt(11, 10).typ = STONE;
    addTrap(level, PIT, 10, 10);
    game._travelTipShown = true;
    initRng(203n);

    await applyInventoryObject(hook, 'll. ' + ' '.repeat(100));

    assert.equal(game.program_state.gameover, true);
    assert.match(loadScoreRecords()[0]?.death ?? '', /^killed by bumping into a wall\b/);
    const screen = requireGameDisplay(game).grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.doesNotMatch(screen, /fall into a pit/, 'the landing spot effects never run');
});
