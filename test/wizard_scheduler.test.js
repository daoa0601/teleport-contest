import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { POT_GAIN_ENERGY, WAN_POLYMORPH } from '../js/object_data.js';
import {
    freshRoleOutcome,
} from './support/role-outcome.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const wizardInput = input => ({
    role: 'Wizard', race: 'human', gender: 'male', align: 'neutral',
    datetime: '20260830171000',
    ...input,
});

const boundWizardInput = input => wizardInput({
    extraOptions: ['playmode:debug'],
    extraLines: ['BIND=v:inventory'],
    ...input,
});

test('debug wishing creates a live charged polymorph wand', async () => {
    // Pinned wizcmds.c:wiz_wish() delegates to makewish().  The committed
    // line must create and carry a real object while leaving command time at
    // zero; a screen painter cannot satisfy the inventory transaction.
    freshWeaponArena();
    game.urole = { key: 'wizard' };
    game.flags.debug = true;
    pushKeys('wand of polymorph (0:30)\n');

    await rhack(23); // Ctrl-W

    const wand = game.inventory.find(object => object.otyp === WAN_POLYMORPH);
    assert.ok(wand);
    assert.equal(wand.charges.current, 30);
    assert.equal(wand.spe, 30);
    assert.equal(game.u.uconduct.wishes, 1);
    assert.equal(game.context.move, 0);
});

test('quaffing commits a potion effect, consumption, and elapsed action',
    async () => {
        // Pinned potion.c:dodrink()/dopotion() select one carried identity,
        // apply its state transition, use it up, and return ECMD_TIME.
        freshWeaponArena();
        game.urole = { key: 'wizard' };
        game.u.uen = game.u.uenmax = game.u.uenpeak = 1;
        const potion = {
            otyp: POT_GAIN_ENERGY,
            invlet: 'a',
            name: 'potion of gain energy',
            plural: 'potions of gain energy',
            class: 'Potions',
            oclass: 8,
            quan: 1,
            quantity: 1,
            where: 'inventory',
            cursed: false,
            blessed: false,
            bknown: true,
            dknown: true,
        };
        game.inventory = [potion];
        pushKey('a');

        await rhack('q'.charCodeAt(0));

        assert.equal(game.inventory.includes(potion), false);
        assert.ok(game.u.uenmax > 1);
        assert.ok(game.u.uen > 1);
        assert.equal(game.context.move, 1);
    });

test('future Wizard commands cannot suppress current live turns', async () => {
    // This independently generated seed deliberately collides with the old
    // replayMoves prefix.  Its physical commands must spend time, move the
    // hero and current actors, and discharge a live carried wand; no expected
    // transcript, screen, coordinate path, or exact call order is copied.
    const seed = 48392;
    const startup = await freshRoleOutcome(wizardInput({
        seed, moves: '', bridgeFree: false,
    }));
    const outcome = await freshRoleOutcome(wizardInput({
        seed, moves: '  nqhzc.rjhlll', bridgeFree: false,
    }));

    assert.equal(startup.error, null);
    assert.equal(outcome.error, null);
    assert.ok(outcome.world.moves > startup.world.moves);
    assert.notDeepEqual(outcome.world.hero, startup.world.hero);
    assert.notDeepEqual(outcome.world.actors, startup.world.actors);
    assert.ok(startup.world.inventory.some(before =>
        before.charges > 0 && outcome.world.inventory.some(after =>
            after.type === before.type
            && after.charges === before.charges - 1)));
});

test('a custom inventory binding dispatches a live item action', async () => {
    // Pinned options.c:parsebindings()/cmd.c:bind_key() replaces the ordinary
    // v command with inventory. Selecting the live f identity and its throw
    // action must detach exactly one carried potion and spend source time.
    const seed = 48601;
    const startup = await freshRoleOutcome(boundWizardInput({
        seed, moves: ' ', bridgeFree: false,
    }));
    const outcome = await freshRoleOutcome(boundWizardInput({
        seed, moves: ' vftl', bridgeFree: false,
    }));
    const selectedType = startup.world.inventory[5].type;
    const countType = (world, type) => world.inventory
        .filter(object => object.type === type)
        .reduce((total, object) => total + object.quantity, 0);

    assert.equal(startup.error, null);
    assert.equal(outcome.error, null);
    assert.equal(
        countType(outcome.world, selectedType),
        countType(startup.world, selectedType) - 1,
    );
    assert.ok(outcome.world.moves > startup.world.moves);
});

test('bound-option Wizard still performs a live debug level teleport',
    async () => {
        // BIND=v:inventory changes only the lowercase v command. Ctrl-V must
        // still run wiz_level_tele(), replace the current level, and arrive at
        // the requested depth; a bind-option classifier cannot swallow it.
        const seed = 48601;
        const startup = await freshRoleOutcome(boundWizardInput({
            seed, moves: ' ', bridgeFree: false,
        }));
        const outcome = await freshRoleOutcome(boundWizardInput({
            seed,
            moves: ` ${String.fromCharCode(22)}2\n`,
            bridgeFree: false,
        }));

        assert.equal(startup.error, null);
        assert.equal(outcome.error, null);
        assert.deepEqual(startup.world.depth, [0, 1]);
        assert.deepEqual(outcome.world.depth, [0, 2]);
        assert.ok(outcome.world.rooms > 0);
        assert.notDeepEqual(outcome.world.hero, startup.world.hero);
    });

test('debug level menu builds the selected live special level', async () => {
    // Pinned dungeon.c:print_dungeon(TRUE) returns the selected special-level
    // identity to level_tele(); deferred_goto() must build that destination,
    // not replay the menu boundary or a recorded level-generation call list.
    const outcome = await freshRoleOutcome(boundWizardInput({
        seed: 48602,
        moves: ` ${String.fromCharCode(22)}?\ne`,
        bridgeFree: false,
    }));

    assert.equal(outcome.error, null);
    assert.deepEqual(outcome.world.depth, [0, 11]);
    assert.equal(outcome.world.prototype, 'bigrm');
    assert.ok(outcome.world.rooms > 0);
    assert.ok(outcome.world.hero[0] > 0);
    assert.ok(outcome.world.hero[1] >= 0);
});

test('request-menu prefix sends debug level teleport directly to live choices',
    async () => {
        // cmd.c gives wiz_level_tele CMD_M_PREFIX. `m Ctrl-V` therefore sets
        // menu_requested and enters print_dungeon(TRUE) without first asking
        // for a numeric line; the selected destination must be a live level.
        const outcome = await freshRoleOutcome(boundWizardInput({
            seed: 48602,
            moves: ` m${String.fromCharCode(22)}e`,
            bridgeFree: true,
        }));

        assert.equal(outcome.error, null);
        assert.deepEqual(outcome.world.depth, [0, 11]);
        assert.equal(outcome.world.prototype, 'bigrm');
        assert.ok(outcome.world.rooms > 0);
        assert.ok(outcome.world.hero[0] > 0);
        assert.ok(outcome.world.hero[1] >= 0);
    });
