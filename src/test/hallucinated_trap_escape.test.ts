import test from 'node:test';
import assert from 'node:assert/strict';

// C trap.c:mintrap() names the web a monster pulls free of with trapname(),
// which picks a random trap name while the hero hallucinates.

import { WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { tryMonsterTrapEscape } from '../js/monster_trap_escape.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

void test('a hallucinating hero sees monsters pull free of varying imaginary traps', async () => {
    const { monster } = await freshMonsterTrapRoom(WEB, { monster: { species: 'gnome' } });
    requirePlayingGame(game);
    await makeHallucinated(100, { talk: false });
    const names = new Set<string>();

    for (let attempt = 0; attempt < 12; attempt++) {
        monster.mtrapped = 1;
        await tryMonsterTrapEscape(monster, game, {
            random: () => 0,
            publish: message => { names.add(message.replace(/^.* pulls free of the (.*)\.$/u, '$1')); },
        });
        assert.equal(monster.mtrapped, 0);
    }

    assert.ok(names.size > 1, `Trap names: ${[...names].join(', ')}`);
});
