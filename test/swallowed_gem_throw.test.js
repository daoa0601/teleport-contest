import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { FLINT } from '../js/object_data.js';
import { game } from '../js/gstate.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { addInventoryObject } from './support/game-objects.js';
// C dothrow.c thitmonst() sends gems through its weapon branch, so a hero
// swallowed by a vortex still hits it with a thrown flint stone instead of
// crashing on an unsupported engulfed projectile.
void test('a swallowed hero hitting the engulfer with a thrown flint stone', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    const vortex = await createMonsterAt('steam vortex', 10, 10, MM_NOGRP | NO_MINVENT);
    vortex.mhp = 40;
    vortex.mhpmax = 40;
    await installSwallowedHero(vortex);
    const flint = await addInventoryObject(FLINT);
    input.feed(`t${flint.invlet}l`);
    await rhack(0);
    assert.match(game._pending_message ?? '', /flint stone hits the steam vortex\./);
});
//# sourceMappingURL=swallowed_gem_throw.test.js.map