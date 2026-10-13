import assert from 'node:assert/strict';
import test from 'node:test';

import { createBonesFromDeath } from '../js/bones_death.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { CORPSE } from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';

void test('a dead human leaves a correctly weighted corpse with a decay timer', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game._canMakeBones = true;
    game.plname = 'Ada';
    // mksobj initially chooses a lizard; mk_named_object must replace its
    // non-decaying body with a timed human body through mkcorpstat.
    initRng(32n);

    await createBonesFromDeath('killed by an orc', async () => 'y');

    const corpse = floorObjectsAt(game.level, 10, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    assert.equal(corpse.corpsenm, game.urace?.mnum);
    assert.equal(corpse.oname, 'Ada');
    assert.equal(corpse.owt, objectWeight(corpse));
    assert.equal(objectTimers(corpse).length, 1);
    assert.equal(objectTimers(corpse)[0]?.kind, OBJECT_TIMER_KIND.ROT_CORPSE);
});

void test('a hero dying as a troll leaves the troll body and its revival timer', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game._canMakeBones = true;
    installPolymorphedHero('troll');

    await createBonesFromDeath('killed by an orc', async () => 'y');

    const corpse = floorObjectsAt(game.level, 10, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse);
    assert.equal(corpse.corpsenm, game.u.umonnum);
    assert.equal(objectTimers(corpse)[0]?.kind, OBJECT_TIMER_KIND.REVIVE_MON);
});

void test('a hero dying as a ghost leaves no corpse or grave', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.storage = memoryStorage();
    game._canMakeBones = true;
    installPolymorphedHero('ghost');
    const originalTerrain = game.level.requireAt(10, 10).typ;

    await createBonesFromDeath('killed by an orc', async () => 'y');

    assert.equal(floorObjectsAt(game.level, 10, 10).some(object => object.otyp === CORPSE), false);
    assert.equal(game.level.requireAt(10, 10).typ, originalTerrain);
});
