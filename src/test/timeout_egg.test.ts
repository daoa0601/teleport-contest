import assert from 'node:assert/strict';
import test from 'node:test';
import { G_EXTINCT, MV_KNOWS_EGG } from '../js/const.js';
import { runClaimedEggHatchTimer, finishEggHatchTimer } from '../js/egg.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG } from '../js/object_data.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, scheduleObjectTimer } from '../js/object_timers.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { vision_recalc } from '../js/vision.js';

void test('seeing an egg hatch teaches the adult egg type even for a young-species egg', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const baby = MONSTER_NAME.indexOf('baby crocodile');
    const adult = MONSTER_NAME.indexOf('crocodile');
    const egg = await floorObject(EGG, 12, 10, { initialize: false, corpsenm: baby });
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, game.moves);
    vision_recalc(0);

    const event = await runClaimedEggHatchTimer(claimNextDueObjectTimer());
    await finishEggHatchTimer(event);

    assert.ok((game.mvitals[adult]?.mvflags ?? 0) & MV_KNOWS_EGG);
    assert.equal((game.mvitals[baby]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
});

void test('the last hatchling before extinction leaves its egg as in the native loop', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const baby = MONSTER_NAME.indexOf('cave spider');
    const adult = MONSTER_NAME.indexOf('giant spider');
    const vital = game.mvitals[baby];
    assert.ok(vital);
    vital.born = 119;
    const egg = await floorObject(EGG, 12, 10, { initialize: false, corpsenm: adult });
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, game.moves);
    vision_recalc(0);

    const event = await runClaimedEggHatchTimer(claimNextDueObjectTimer());
    await finishEggHatchTimer(event);

    assert.ok(game.level.monsters.some(monster => monster.mnum === baby));
    assert.ok(vital.mvflags & G_EXTINCT);
    assert.equal(egg.quan, 1);
    assert.equal(egg.where, 'floor');
    assert.equal(egg.timed, 1);
});

void test('hatching the held egg releases its weapon and inventory ownership', async () => {
    freshObjectRoom();
    const egg = await addInventoryObject(EGG, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('crocodile'),
    });
    await setPrimaryWeapon(egg);
    scheduleObjectTimer(egg, OBJECT_TIMER_KIND.HATCH_EGG, game.moves);
    vision_recalc(0);

    const event = await runClaimedEggHatchTimer(claimNextDueObjectTimer());
    await finishEggHatchTimer(event);

    assert.equal(egg.where, 'gone');
    assert.equal(game.inventory.includes(egg), false);
    assert.ok(!game.uwep && !game.u.uwep, 'The hatched egg is still held as a weapon');
});
