import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { NO_MINVENT, PANICLOG } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FUZZER_IMPOSSIBLE_PANIC, impossible } from '../js/diagnostics.js';
import { PanicTermination } from '../js/panic_termination.js';
import { inventoryItemDescription, selectInventoryObject } from '../js/invent.js';
import { LEASH, POT_HEALING, TIN, TIN_OPENER } from '../js/object_data.js';
import { useTinOpener } from '../js/tin.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

function visibleText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

function loggedReasons(): string[] {
    return (game.storage?.getItem(PANICLOG) || '').split('\n').filter(Boolean).map(line => {
        const record: unknown = JSON.parse(line);
        assert.ok(record && typeof record === 'object' && 'reason' in record
            && typeof record.reason === 'string');
        return record.reason;
    });
}

// Answer every key request, recording each screen the hero is asked about.
function recordScreens(): string[] {
    const screens: string[] = [];
    const input = resetInputState();
    input.display = {
        readKey(): Promise<number> {
            const screen = visibleText();
            screens.push(screen);
            assert.ok(screens.length <= 16, 'too many key requests');
            return Promise.resolve(screen.includes('--More--') ? 32 : 27);
        },
    };
    return screens;
}

function firstScreenIndex(screens: readonly string[], pattern: RegExp): number {
    const index = screens.findIndex(screen => pattern.test(screen));
    assert.notEqual(index, -1, `no screen matched ${pattern}:\n${screens.join('\n----\n')}`);
    return index;
}

void test('a leash attached to a missing monster reports impossible() before the inventory menu', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    game.program_state.something_worth_saving = true;
    const leash = await addInventoryObject(LEASH);
    leash.leashmon = 4242;
    const screens = recordScreens();

    await rhack('i'.charCodeAt(0));

    const diagnostic = firstScreenIndex(screens, /leashed monster #4242 not found/);
    const menu = firstScreenIndex(screens, /an uncursed leash/);
    assert.ok(diagnostic < menu, 'the diagnostic precedes the menu that names the leash');
    assert.match(screens.join('\n'), /Program in disorder!/);
    assert.doesNotMatch(screens.join('\n'), /attached to/);
    assert.equal(leash.leashmon, 0);
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
});

void test('an unpaid object missing from the bill reports unpaid_cost impossible() before the menu', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const potion = await addInventoryObject(POT_HEALING);
    potion.unpaid = true;
    await createStaffedShop();
    game.u.ux = 11;
    game.u.uy = 11;
    const screens = recordScreens();

    await rhack('i'.charCodeAt(0));

    const diagnostic = firstScreenIndex(screens, /unpaid_cost: object wasn't on any bill\./);
    const menu = firstScreenIndex(screens, /potion.*\(unpaid, 0 zorkmids\)/);
    assert.ok(diagnostic < menu, 'the diagnostic precedes the menu that prices the potion');
    assert.deepEqual(loggedReasons(), ["unpaid_cost: object wasn't on any bill."]);
});

void test('a leash attached to a dead monster reports that monster as not found', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    pet.mhp = 0;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    recordScreens();

    await rhack('i'.charCodeAt(0));

    assert.deepEqual(loggedReasons(), [`leashed monster #${pet.m_id} not found`]);
    assert.equal(leash.leashmon, 0);
});

void test('a pending formatter report and a later impossible() both complete', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    const screens = recordScreens();

    inventoryItemDescription(leash);
    await impossible('second report');

    const all = screens.join('\n----\n') + '\n' + visibleText();
    assert.doesNotMatch(all, /impossible called impossible/);
    assert.ok(all.indexOf('leashed monster #4242 not found') < all.lastIndexOf('second report'));
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found', 'second report']);
    assert.equal(game.program_state.in_impossible, false);
});

void test('a stopped message window still shows a tin opener report before the wield question', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    await createStaffedShop();
    game.u.ux = 11;
    game.u.uy = 11;
    await addInventoryObject(TIN);
    const opener = await addInventoryObject(TIN_OPENER, { cursed: true, bknown: true });
    opener.unpaid = true;
    // An Escaped --More-- stops further ordinary messages until the next key.
    game._suppressMessagesUntilInput = true;
    const screens = recordScreens();

    await useTinOpener(opener);

    const diagnostic = firstScreenIndex(screens, /unpaid_cost: object wasn't on any bill\./);
    const question = firstScreenIndex(screens, /Really wield/);
    assert.ok(diagnostic < question, screens.join('\n----\n'));
    assert.doesNotMatch(screens[question] ?? '', /unpaid_cost/);
    assert.notEqual(game.uwep, opener, 'Escape answers the question, not the diagnostic');
});

void test('a singleton leash choice is read after its impossible() report, not over it', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    const letter = leash.invlet ?? '';
    const screens = recordScreens();

    await selectInventoryObject({ letters: letter });

    const diagnostic = firstScreenIndex(screens, /leashed monster #4242 not found/);
    const choice = firstScreenIndex(screens, new RegExp(`${letter} - an uncursed leash\\.`));
    const report = firstScreenIndex(screens, /Please report these messages/);
    assert.ok(diagnostic < report && report < choice, screens.join('\n----\n'));
    assert.match(screens.at(-1) ?? '', new RegExp(`${letter} - an uncursed leash\\.`),
        'the selection key is read with the choice still shown');
});

void test('impossible() panic mode stops the leash formatter before it detaches the leash', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    game.flags.debug_fuzzer = FUZZER_IMPOSSIBLE_PANIC;
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    recordScreens();

    await assert.rejects(rhack('i'.charCodeAt(0)), PanicTermination);

    assert.equal(leash.leashmon, 4242);
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
});
