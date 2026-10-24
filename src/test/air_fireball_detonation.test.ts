import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_FIREBALL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { zapRayWithObject } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';

// zap.c:dobuzz(): a fireball spell that leaves the map on the Plane of Air
// reports that it "vanishes into the aether", then still explodes at the
// cell it entered, with the blast coerced to a wand-style fire explosion.
void test('a fireball vanishing into the aether still detonates at the edge', async () => {
    freshObjectRoom({ hero: { ulevel: 1, dx: 1, dy: 0, dz: 0 } });
    requirePlayingGame(game);
    game.air_level = { ...game.u.uz, flags: { town: false }, alignment: null };
    const jackal = await createMonsterAt('jackal', 16, 9, NO_MINVENT);
    jackal.mhp = jackal.mhpmax = 1000;
    const spell = await knownObject(SPE_FIREBALL);
    installPagerInput(resetInputState(), { expected: /fireball|aether|Boom|jackal/i, limit: 8 });
    initRng(5n);

    await zapRayWithObject(spell);

    assert.ok(1000 - jackal.mhp > 0, 'the vanished fireball still detonates by the edge');
    assert.equal(game.u.uhp, 40);
});
