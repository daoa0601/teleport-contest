import test from 'node:test';
import assert from 'node:assert/strict';

import { getBridgeUsageLedger } from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { WAN_SLEEP } from '../js/object_data.js';
import {
    freshRoleOutcome, outcomesAcrossModes,
} from './support/role-outcome.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const healerInput = input => ({
    role: 'Healer', race: 'human', align: 'neutral',
    datetime: '20260830150000',
    ...input,
});

test('future szf text cannot select a fresh Healer scheduler', async () => {
    // Saving blocks before the suffix is interpreted.  Those future bytes
    // may not choose startup, actor movement, global maintenance, or any
    // other current-world owner.  The seed is generated and independent of
    // the old new-moon recording.
    const world = await outcomesAcrossModes(healerInput({
        seed: 44001,
        moves: ' ....Sszf',
    }));

    assert.equal(world.moves, 5);
    assert.equal(world.heroMovement, 12);
    assert.ok(world.actors.some(actor => actor.tame > 0));
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
    const world = await outcomesAcrossModes(healerInput({
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
    assert.deepEqual(getBridgeUsageLedger().bridges, {});
});

test('both legal Healer races share live actor scheduling', async () => {
    for (const input of [
        { seed: 44011, race: 'human' },
        { seed: 44012, race: 'gnome' },
    ]) {
        const world = await outcomesAcrossModes(healerInput({
            ...input,
            moves: ' ....',
        }));
        assert.equal(world.heroMovement, 12);
        assert.ok(world.actors.some(actor => actor.tame > 0));
    }
});
