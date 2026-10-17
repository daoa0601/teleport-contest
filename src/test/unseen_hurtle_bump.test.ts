import assert from 'node:assert/strict';
import test from 'node:test';

// C dothrow.c:hurtle_step() names a monster hurtling into the hero with
// Some_Monnam(), so a hero who cannot see it learns only "Someone".

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an unseen humanoid hurtled into a blind hero is someone', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const gnome = await createMonsterAt('gnome lord', ux + 2, uy, NO_MINVENT);
    setHeroBlindnessTurns(20);
    vision_recalc(0);

    await hurtleMonster(gnome, -1, 0, 3, { random: () => 0 });

    assert.equal(gnome.mx, ux + 1);
    assert.match(game._pending_message, /Someone bumps into you\./);
});
