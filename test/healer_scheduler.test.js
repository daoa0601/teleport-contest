import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { WAN_SLEEP } from '../js/object_data.js';
import {
    bridgeFreeRoleOutcome, freshRoleOutcome,
} from './support/role-outcome.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const healerInput = input => ({
    role: 'Healer', race: 'human', align: 'neutral',
    datetime: '20260830150000',
    ...input,
});

function actorOutcomes(world) {
    return world.actors.map(actor => ({
        species: actor.species,
        position: actor.position,
        hp: actor.hp,
        inventory: actor.inventory,
    }));
}

test('a save-blocked suffix cannot alter elapsed Healer waits', async () => {
    // Saving blocks before the suffix is interpreted.  Those future bytes
    // may not choose startup, actor movement, global maintenance, or any
    // other current-world owner.  The seed is generated and independent of
    // the old new-moon recording.
    const startup = await bridgeFreeRoleOutcome(healerInput({
        seed: 44001,
        moves: ' ',
    }));
    const world = await bridgeFreeRoleOutcome(healerInput({
        seed: 44001,
        moves: ' ....Sszf',
    }));

    assert.deepEqual(world.hero, startup.hero);
    assert.equal(world.moves, 5);
    assert.equal(world.heroMovement, 12);
    assert.notDeepEqual(actorOutcomes(world), actorOutcomes(startup));
});

test('a self-zapped sleep wand advances live helpless turns', async () => {
    // Pinned zap.c:zapyourself(WAN_SLEEP) identifies the effect, rolls a
    // finite sleep duration, installs negative multi, and lets ordinary
    // moveloop maintenance and actors run until timeout.c:fall_asleep's
    // wake message.  A fixed bulk RNG replay cannot satisfy the live world.
    const seed = 44007;
    const startup = await freshRoleOutcome(healerInput({
        seed, moves: ' ', bridgeFree: true,
    }));
    const world = await bridgeFreeRoleOutcome(healerInput({
        seed, moves: ' zf.',
    }));
    const initialWand = startup.world.inventory.find(object =>
        object.type === WAN_SLEEP);
    const remainingWand = world.inventory.find(object =>
        object.type === WAN_SLEEP);

    assert.equal(startup.error, null);
    assert.ok(initialWand);
    assert.ok(remainingWand);
    assert.equal(remainingWand.charges, initialWand.charges - 1);
    assert.ok(world.moves > 2);
    assert.equal(world.heroMovement, 12);
    assert.equal(world.helplessTurns, 0);
    assert.match(world.message, /You wake up\.$/);
});

test('minimum self-sleep wakes on the first live global turn', async () => {
    // This generated seed selects rnd(50) == 1.  C increments negative
    // multi after that first global allocation, so the hero wakes at move 2;
    // requiring an extra turn would be an off-by-one scheduler error.
    const world = await bridgeFreeRoleOutcome(healerInput({
        seed: 44001,
        moves: ' zf.',
    }));

    assert.equal(world.moves, 2);
    assert.equal(world.heroMovement, 12);
    assert.equal(world.helplessTurns, 0);
    assert.match(
        world.message,
        /The sleep ray hits you!.*You wake up\.$/,
    );
});

test('sleep resistance prevents self-zap helplessness', async () => {
    freshWeaponArena();
    game.urole = { key: 'healer' };
    game.u.sleepResistance = true;
    const wand = {
        otyp: WAN_SLEEP,
        invlet: 'a',
        name: 'sleep',
        oclass: 11,
        quan: 1,
        quantity: 1,
        charges: { current: 3, recharged: 0 },
        spe: 3,
        dknown: true,
        bknown: true,
    };
    game.inventory = [wand];
    pushKey('a');
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(wand.charges.current, 2);
    assert.equal(wand.typeKnown, true);
    assert.equal(game._helplessTurns, undefined);
    assert.equal(game._pending_message, "You don't feel sleepy!");
    assert.equal(game.context.move, 1);
});
