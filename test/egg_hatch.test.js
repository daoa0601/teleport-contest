import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, MV_KNOWS_EGG } from '../js/const.js';
import {
    finishEggHatchTimer, runClaimedEggHatchTimer,
} from '../js/egg.js';
import { place_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { EGG } from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { objectWeight } from '../js/weight.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';


function freshEggState(seed) {
    freshObjectRoom({
        left: 8, right: 16, top: 7, bottom: 13,
        hero: { deafTurns: 0 },
        flags: { female: true },
        context: { move: 0, nopick: false },
        moves: 2,
        gameplaySeed: seed,
    });
}


function hatchTimer(egg) {
    const timers = objectTimers(egg);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].kind, OBJECT_TIMER_KIND.HATCH_EGG);
    return timers[0];
}

test('fresh floor egg hatches visibly, teaches its type, and is deleted',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, 94); // cave spider
        assert.equal(egg.quan, 1);
        const timer = hatchTimer(egg);
        assert.equal(timer.deadline, 165);

        game.moves = timer.deadline;
        const claimed = claimNextDueObjectTimer(game, game.moves);
        const event = await runClaimedEggHatchTimer(
            claimed, game, game.moves,
        );
        assert.equal(event.message, 'You see a cave spider hatch.');
        assert.equal(event.hatched, 1);
        assert.equal(egg.quan, 0);
        assert.equal(egg.where, 'floor');
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(game.level.objects[12][10].includes(egg), false);
        assert.equal(objectTimers(egg).length, 0);
        assert.ok(game.mvitals[94].mvflags & MV_KNOWS_EGG);
    });

test('floor egg stack hatches a younger form and schedules its remainder',
    async () => {
        freshEggState(10);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, 328); // crocodile
        assert.equal(egg.quan, 2);
        const timer = hatchTimer(egg);

        game.moves = timer.deadline;
        initRng(4n); // rnd(2)=1 leaves one egg in the stack
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.mnum, 325); // baby crocodile
        assert.equal(event.message, 'You see a baby crocodile hatch.');
        assert.equal(egg.quan, 1);

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'floor');
        assert.equal(egg.owt, objectWeight(egg));
        const remainder = hatchTimer(egg);
        assert.ok(remainder.deadline >= game.moves + 1);
        assert.ok(remainder.deadline <= game.moves + 12);
        assert.ok(game.level.monsters.some(monster => monster.mnum === 325));
        assert.ok(game.mvitals[328].mvflags & MV_KNOWS_EGG);
    });

test('overdue floor hatching is silent and does not teach egg identity',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline + 20;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message, null);
        assert.equal(event.hatched, 1);
        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal((game.mvitals[94]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

test('genocide consumes the hatch attempt but leaves the egg untimed',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        const timer = hatchTimer(egg);
        game.mvitals[94] = { mvflags: G_GENOD };
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.unavailable, true);
        assert.equal(event.hatched, 0);
        assert.equal(egg.quan, 1);
        assert.equal(egg.where, 'floor');
        assert.equal(objectTimers(egg).length, 0);
        assert.equal(game.level.monsters.some(monster => monster.mnum === 94),
            false);
    });

test('unowned carried egg hatches beside a female hero before pack deletion',
    async () => {
        freshEggState(2);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You see a cave spider drop out of your pack!');
        assert.equal(event.hatched, 1);
        assert.ok(game.inventory.includes(egg));
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(game.inventory.includes(egg), false);
        assert.ok(game.mvitals[94].mvflags & MV_KNOWS_EGG);
    });

test('blind carried hatching uses tactile prose and does not teach identity',
    async () => {
        freshEggState(2);
        game.blind = true;
        game.u.blindTurns = 10;
        vision_recalc(0);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;

        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You feel something drop from your pack!');
        finishEggHatchTimer(event, game, game.moves);
        assert.equal((game.mvitals[94]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

test('carried egg stack keeps its remainder and short timer after pack prose',
    async () => {
        freshEggState(10);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        initRng(4n);
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You see a baby crocodile drop out of your pack!');
        assert.equal(egg.quan, 1);
        assert.equal(objectTimers(egg).length, 0);
        finishEggHatchTimer(event, game, game.moves);
        assert.ok(game.inventory.includes(egg));
        assert.equal(egg.where, 'inventory');
        assert.ok(hatchTimer(egg).deadline >= game.moves + 1);
        assert.ok(hatchTimer(egg).deadline <= game.moves + 12);
    });

test('a hero-laid floor egg hatches a tame monster', async () => {
    freshEggState(2);
    const egg = place_object(mksobj(EGG, true, false), 12, 10);
    egg.spe = 1;
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.ok(event.monster.mtame > 0);
    assert.equal(event.monster.mpeaceful, 1);
    finishEggHatchTimer(event, game, game.moves);
});

test('a dragon egg in the pack hatches a tame dragon', async () => {
    freshEggState(2);
    const egg = mksobj(EGG, true, false);
    egg.corpsenm = 143; // gray dragon
    egg.quan = egg.quantity = 1;
    egg.where = 'inventory';
    game.inventory = [egg];
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.mnum, 133); // baby gray dragon
    assert.ok(event.monster.mtame > 0);
    assert.equal(event.followupMessage, 'Gleep!');
    finishEggHatchTimer(event, game, game.moves);
});

test('an egg hatches out of a visible monster pack', async () => {
    freshEggState(2);
    const carrier = addMonster({
        mnum: 260,
        m_id: 7001,
        x: 12,
        y: 10,
        hitPoints: 10,
    });
    const egg = mksobj(EGG, true, false);
    egg.quan = egg.quantity = 1;
    linkObjectToMonsterInventory(carrier, egg);
    const timer = hatchTimer(egg);
    game.moves = timer.deadline;

    const event = await runClaimedEggHatchTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(
        event.message,
        "You see a cave spider drop out of a human's pack!",
    );
    finishEggHatchTimer(event, game, game.moves);
    assert.equal(carrier.minvent.includes(egg), false);
    assert.equal(egg.where, 'gone');
});
