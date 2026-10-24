import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import type { RngSeed } from '../js/rng.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, MV_KNOWS_EGG } from '../js/const.js';
import {
    finishEggHatchTimer, runClaimedEggHatchTimer,
} from '../js/egg.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { EGG } from '../js/object_data.js';
import { inventoryItemDescription } from '../js/invent.js';
import { addCreatedInventoryItem } from '../js/u_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { objectWeight } from '../js/weight.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('known egg contents name their species without acquired egg-type knowledge', async () => {
    freshObjectRoom();
    const egg = await mksobj(EGG, false, false);
    egg.corpsenm = MONSTER_NAME.indexOf('cockatrice');
    egg.quan = 2;
    egg.known = true;
    await addCreatedInventoryItem(egg);

    assert.equal(await inventoryItemDescription(egg), '2 cockatrice eggs');
});


function freshEggState(seed: RngSeed) {
    freshObjectRoom({
        left: 8, right: 16, top: 7, bottom: 13,
        hero: { deafTurns: 0 },
        flags: { female: true },
        context: { move: 0, nopick: false },
        moves: 2,
        gameplaySeed: seed,
    });
}


function hatchTimer(egg: GameObject) {
    const timers = objectTimers(egg);
    assert.equal(timers.length, 1);
    const [timer] = timers;
    assert.ok(timer);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.HATCH_EGG);
    return timer;
}

void test('fresh floor egg hatches visibly, teaches its type, and is deleted',
    async () => {
        freshEggState(2);
        requireFixtureGame(game);
        const egg = placeCreatedObject(await mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, MONSTER_NAME.indexOf('giant spider'));
        assert.equal(egg.quan, 1);
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        assert.ok(timer.deadline >= game.moves + 151 && timer.deadline <= game.moves + 200);

        game.moves = timer.deadline;
        const claimed = claimNextDueObjectTimer(game, game.moves);
        const event = await runClaimedEggHatchTimer(
            claimed, game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.equal(event.message, 'You see a cave spider hatch.');
        assert.equal(event.hatched, 1);
        assert.equal(egg.quan, 0);
        assert.equal(egg.where, 'floor');
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        await finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(floorObjectsAt(requireGameLevel(game), 12, 10).includes(egg), false);
        assert.equal(objectTimers(egg).length, 0);
        assert.ok((game.mvitals[egg.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG);
    });

void test('floor egg stack hatches a younger form and schedules its remainder',
    async () => {
        freshEggState(10);
        requireFixtureGame(game);
        const egg = placeCreatedObject(await mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, 328); // crocodile
        assert.equal(egg.quan, 2);
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);

        game.moves = timer.deadline;
        initRng(4n); // rnd(2)=1 leaves one egg in the stack
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.ok('mnum' in event);
        assert.equal(event.mnum, 325); // baby crocodile
        assert.equal(event.message, 'You see a baby crocodile hatch.');
        assert.equal(egg.quan, 1);

        await finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'floor');
        assert.equal(egg.owt, objectWeight(egg));
        const remainder = hatchTimer(egg);
        assert.ok(remainder.deadline >= game.moves + 1);
        assert.ok(remainder.deadline <= game.moves + 12);
        assert.ok(game.level.monsters.some(monster => monster.mnum === 325));
        assert.ok((game.mvitals[328]?.mvflags ?? 0) & MV_KNOWS_EGG);
    });

void test('overdue floor hatching is silent and does not teach egg identity',
    async () => {
        freshEggState(2);
        requireFixtureGame(game);
        const egg = placeCreatedObject(await mksobj(EGG, true, false), 12, 10);
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline + 20;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.equal(event.message, null);
        assert.equal(event.hatched, 1);
        await finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal((game.mvitals[egg.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

void test('genocide consumes the hatch attempt but leaves the egg untimed',
    async () => {
        freshEggState(2);
        requireFixtureGame(game);
        const egg = placeCreatedObject(await mksobj(EGG, true, false), 12, 10);
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        game.mvitals[94] = { born: 0, died: 0, mvflags: G_GENOD };
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.ok('unavailable' in event);
        assert.equal(event.unavailable, true);
        assert.equal(event.hatched, 0);
        assert.equal(egg.quan, 1);
        assert.equal(egg.where, 'floor');
        assert.equal(objectTimers(egg).length, 0);
        assert.equal(game.level.monsters.some(monster => monster.mnum === 94),
            false);
    });

void test('unowned carried egg hatches beside a female hero before pack deletion',
    async () => {
        freshEggState(2);
        requireFixtureGame(game);
        const egg = await mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.equal(event.message,
            'You see a cave spider drop out of your pack!');
        assert.equal(event.hatched, 1);
        assert.ok(game.inventory.includes(egg));
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        await finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(game.inventory.includes(egg), false);
        assert.ok((game.mvitals[egg.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG);
    });

void test('blind carried hatching uses tactile prose and does not teach identity',
    async () => {
        freshEggState(2);
        requireFixtureGame(game);
        game.blind = true;
        game.u.blindTurns = 10;
        vision_recalc(0);
        const egg = await mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;

        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.equal(event.message,
            'You feel something drop from your pack!');
        await finishEggHatchTimer(event, game, game.moves);
        assert.equal((game.mvitals[egg.corpsenm]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

void test('carried egg stack keeps its remainder and short timer after pack prose',
    async () => {
        freshEggState(10);
        requireFixtureGame(game);
        const egg = await mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        assert.ok(egg.corpsenm !== undefined);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        initRng(4n);
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.ok(event, 'The due object timer must produce its effect.');
        assert.equal(event.message,
            'You see a baby crocodile drop out of your pack!');
        assert.equal(egg.quan, 1);
        assert.equal(objectTimers(egg).length, 0);
        await finishEggHatchTimer(event, game, game.moves);
        assert.ok(game.inventory.includes(egg));
        assert.equal(egg.where, 'inventory');
        assert.ok(hatchTimer(egg).deadline >= game.moves + 1);
        assert.ok(hatchTimer(egg).deadline <= game.moves + 12);
    });

void test('a hero-laid floor egg hatches a tame monster', async () => {
    freshEggState(2);
    requireFixtureGame(game);
    const egg = placeCreatedObject(await mksobj(EGG, true, false), 12, 10);
    egg.spe = 1;
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.ok(event, 'The due object timer must produce its effect.');

    assert.ok('monster' in event && event.monster);
    assert.ok((event.monster.mtame ?? 0) > 0);
    assert.equal(event.monster.mpeaceful, 1);
    await finishEggHatchTimer(event, game, game.moves);
});

void test('a dragon egg in the pack hatches a tame dragon', async () => {
    freshEggState(2);
    requireFixtureGame(game);
    const egg = await mksobj(EGG, true, false);
    egg.corpsenm = 143; // gray dragon
    egg.quan = egg.quantity = 1;
    egg.where = 'inventory';
    game.inventory = [egg];
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.ok(event, 'The due object timer must produce its effect.');

    assert.ok('mnum' in event);
    assert.equal(event.mnum, 133); // baby gray dragon
    assert.ok('monster' in event && event.monster);
    assert.ok((event.monster.mtame ?? 0) > 0);
    assert.equal(event.followupMessage, '"Gleep!"');
    await finishEggHatchTimer(event, game, game.moves);
});

void test('an egg hatches out of a visible monster pack', async () => {
    freshEggState(2);
    requireFixtureGame(game);
    const egg = await mksobj(EGG, true, false);
    egg.quan = egg.quantity = 1;
    const carrier = await createMonsterAt('human', 12, 10);
    await linkObjectToMonsterInventory(carrier, egg);
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.ok(event, 'The due object timer must produce its effect.');

    assert.equal(
        event.message,
        "You see a cave spider drop out of a human's pack!",
    );
    await finishEggHatchTimer(event, game, game.moves);
    assert.equal(carrier.minvent.includes(egg), false);
    assert.equal(egg.where, 'gone');
});
