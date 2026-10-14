import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import type { GameObject } from '../js/object_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CORPSE } from '../js/object_data.js';
import { SINK as SINK_TERRAIN } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { addInventoryObject, knownObject, artifactObject } from './support/game-objects.js';
import { addInventoryItem } from '../js/u_init.js';
import { invokeInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addBuriedObject } from '../js/buried_object.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
} from '../js/object_timers.js';

const DAGGER = OBJECT_NAMES.indexOf('dagger');
const LOADSTONE = OBJECT_NAMES.indexOf('loadstone');
const RIN_GAIN_STRENGTH = OBJECT_NAMES.indexOf('gain strength');
const GOLD_PIECE = OBJECT_NAMES.indexOf('gold piece');

// The count is typed at the drop prompt itself (C "d3a"), so the digits
// and the item letter are queued together for the prompt the command
// raises.
function dropCommand(promptAnswer: string) {
    pushKeys(promptAnswer);
    return rhack('d'.charCodeAt(0));
}

function zombifyRemaining(corpse: GameObject, state = game) {
    const timer = objectTimers(corpse).find(candidate =>
        candidate.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
    return timer ? timer.deadline - (state.moves ?? 0) : null;
}

// C menudrop_split + drop(): a counted drop splits an uncursed wielded
// stack; the requested quantity lands, the remainder stays wielded.
void test('a counted drop from a wielded stack splits and keeps the remainder wielded',
    async () => {
        freshObjectRoom({ gameplaySeed: 91 });
        requireFixtureGame(game);
        const daggers = await addInventoryObject(DAGGER,
            { invlet: 'a', quan: 5, quantity: 5 });
        await setPrimaryWeapon(daggers, game);

        await dropCommand('3a ');

        const pile = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || [];
        const dropped = pile.find(object => object.otyp === DAGGER);
        assert.ok(dropped, 'the requested quantity reached the floor');
        assert.equal(dropped.quan ?? dropped.quantity, 3);
        assert.ok(game.inventory.includes(daggers));
        assert.equal(daggers.quan ?? daggers.quantity, 2);
        assert.equal(game.uwep ?? game.u?.uwep, daggers);
        assert.equal(game.context.move, 1);
    });

// C do.c:685-698 canletgo: with a count below the stack size the getobj
// kludge sets corpsenm, so the refusal names "any of" the stones.
void test('a counted cursed loadstone refusal keeps the whole stack', async () => {
    freshObjectRoom({ gameplaySeed: 92 });
    requireFixtureGame(game);
    const stones = await addInventoryObject(LOADSTONE,
        { invlet: 'a', quan: 2, quantity: 2, cursed: true, bknown: false });

    await dropCommand('1a');

    assert.ok(game.inventory.includes(stones));
    assert.equal(stones.quan ?? stones.quantity, 2);
    assert.equal((floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || []).length, 0);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /cannot drop any of the stones!/);
});

// C do.c:736-751: selected gold dropped while swallowed joins the
// engulfer's inventory instead of reaching a floor that is not there.
void test('gold dropped while swallowed enters the engulfer inventory', async () => {
    freshObjectRoom({ gameplaySeed: 93 });
    requireFixtureGame(game);
    const worm = await createMonsterAt('purple worm', game.u.ux, game.u.uy);
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    setHeroGoldAmount(game, 100);

    await dropCommand('$');

    assert.equal(game.u.uswallow, 1);
    const carried = (worm.minvent || []).find(object =>
        object.otyp === GOLD_PIECE);
    assert.ok(carried, 'the gold entered the engulfer pack');
    assert.equal((floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || []).length, 0);
});

// C do.c:753-757: the sink-ring diversion runs before the floor-reach
// test, so it works while levitating; the ring ends in exactly one legal
// place (down the drain, or backed up onto the floor), and a blind hero
// observes it through state alone.
void test('a ring dropped over a sink while levitating diverts to the sink',
    async () => {
        freshObjectRoom({ gameplaySeed: 94 });
        requireFixtureGame(game);
        game.level.requireAt(game.u.ux, game.u.uy).typ = SINK_TERRAIN;
        grantIntrinsicProperty('levitation', 'outside');
        setHeroBlindnessTurns(20, game);
        vision_recalc(0);
        const ring = await addInventoryObject(RIN_GAIN_STRENGTH, { invlet: 'a' });
        assert.equal(game.u.levitating, true);

        await dropCommand('a ');

        assert.equal(game.inventory.includes(ring), false);
        const onFloor = (floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || [])
            .includes(ring);
        // down the drain buries the ring under the sink; a backed-up sink
        // returns it to the floor; both are legal single dispositions
        assert.ok(onFloor || ['gone', 'buried'].includes(ring.where));
        if (onFloor) assert.equal(ring.where, 'floor');
        assert.equal(game.u.levitating, true);
        assert.equal(game.context.move, 1);
    });

// C do.c:758-772: after a real #invoke of the Heart of Ahriman, dropping
// it lands the artifact at the hero's square with a violent (weight 10)
// impact, cutting the revival deadline of a buried zombie corpse nearby
// to two thirds, then float_down lands the hero.
void test('invoking then dropping the Heart of Ahriman lands item then hero',
    async () => {
        freshObjectRoom({ gameplaySeed: 95 });
        requireFixtureGame(game);
        const corpse = await knownObject(CORPSE, { corpsenm: 0 });
        addBuriedObject(corpse, game.u.ux + 1, game.u.uy, game);
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON,
            (game.moves ?? 0) + 30, game);
        const before = zombifyRemaining(corpse);
        const heart = await artifactObject('The Heart of Ahriman');
        await addInventoryItem(heart, null, true);

        await invokeInventoryObject(heart, ' ');
        assert.equal(game.u.levitating, true);

        await dropCommand('a    ');

        assert.ok((floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy) || [])
            .includes(heart));
        assert.equal(game.u.levitating, false);
        assert.equal(game.context.move, 1);
        // the violent impact cut the zombie's remaining revival time to 2/3
        const after = zombifyRemaining(corpse);
        assert.ok(before !== null && before !== undefined);
        assert.equal(after, Math.floor((before * 2) / 3));
    });
