import test from 'node:test';
import assert from 'node:assert/strict';

// C polyself.c:dospit() throws through dothrow.c:throwit(), which recoils a
// floating spitter after bhit() (dothrow.c:1682). A fatal hurtle ends in
// done(), which never returns, so the venom never breaks at its landing
// square (breakmsg()'s "Splash!" never prints). The unchanging spitter dies
// inside the bump itself (polyself.c:rehumanize()) instead of reverting.

import { STONE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import type { DirectionSelection } from '../js/tty_prompts.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { heroSpitAttack, useHeroSpit } from '../js/hero_spit.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createDungeon } from './support/topology.js';

void test('a spitter killed by the recoil never breaks the venom', async () => {
    const level = await freshMonsterAbilityRoom('cobra', {
        polymorph: { hitPoints: 1, maxHitPoints: 1, unchanging: true },
        flags: { verbose: true, bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    game.plname = 'Victim';
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    // Spitting west recoils the floating spitter east into solid rock.
    level.requireAt(11, 10).typ = STONE;
    grantIntrinsicProperty('levitation', 'outside');
    resetInputState();
    initRng(1n);

    pushKeys(' '.repeat(100));
    const west: DirectionSelection = { key: 'h', dx: -1, dy: 0, dz: 0 };
    await useHeroSpit({
        state: game,
        attack: heroSpitAttack(game),
        readDirection: async () => west,
        captureFlight: async () => undefined,
    });

    assert.equal(game.program_state.gameover, true);
    const screen = requireGameDisplay(game).grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /Killed while stuck in creature/);
    assert.doesNotMatch(screen, /Splash!/, 'the venom never breaks after the fatal bump');
});
