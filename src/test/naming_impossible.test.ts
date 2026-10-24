import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN, NO_MINVENT, PANICLOG } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FUZZER_IMPOSSIBLE_PANIC, impossible } from '../js/diagnostics.js';
import { bot, flush_screen, moreUntilDismissed, plineWithContinuation } from '../js/display.js';
import { containerContents } from '../js/container_contents.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { PanicTermination } from '../js/panic_termination.js';
import { inventoryItemDescription, selectInventoryObject } from '../js/invent.js';
import { LEASH, POT_HEALING, SACK, TIN, TIN_OPENER } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { useTinOpener } from '../js/tin.js';
import { quoteShopGoods } from '../js/shop_price_quote.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { priceQuoteSuffix } from '../js/object_knowledge.js';
import { SELL_DELIBERATE, SELL_NORMAL, sellHeroDroppedObject, setSellDisposition } from '../js/shop_sell.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop, setShopkeeperGold } from './support/shop.js';

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
function recordScreens(input = resetInputState()): string[] {
    const screens: string[] = [];
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

void test('naming leaves a missing leash attached until its diagnostic returns', async () => {
    freshPlayableRoom();
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    const input = resetInputState();
    const screens: string[] = [];
    input.display = {
        readKey(): Promise<number> {
            const screen = visibleText();
            screens.push(screen);
            assert.ok(screens.length <= 8, 'too many missing-leash key requests');
            if (screen.includes('leashed monster #4242 not found'))
                assert.equal(leash.leashmon, 4242, 'native repairs the attachment after impossible() returns');
            return Promise.resolve(screen.includes('--More--') ? 32 : 27);
        },
    };

    await rhack('i'.charCodeAt(0));

    firstScreenIndex(screens, /leashed monster #4242 not found/);
    assert.equal(leash.leashmon, 0);
});

void test('a credit offer reports a missing leash once while shortening its long name', async () => {
    freshPlayableRoom({ flags: { verbose: false } });
    game.storage = memoryStorage();
    const name = 'a keepsake from the long journey through the mountains and sea';
    const leash = await floorObject(LEASH, game.u.ux, game.u.uy, {
        leashmon: 4242, oextra: { oname: name },
    });
    const { shopkeeper } = await createStaffedShop();
    await setShopkeeperGold(shopkeeper, 0);
    const input = resetInputState();
    const screens: string[] = [];
    input.display = {
        readKey(): Promise<number> {
            const screen = visibleText();
            screens.push(screen);
            assert.ok(screens.length <= 16, 'too many credit-offer key requests');
            return Promise.resolve(screen.includes('--More--') ? 32 : 'n'.charCodeAt(0));
        },
    };
    setSellDisposition(SELL_DELIBERATE);
    try {
        await sellHeroDroppedObject(leash, game.u.ux, game.u.uy);
    } finally {
        setSellDisposition(SELL_NORMAL);
    }

    const diagnostic = firstScreenIndex(screens, /leashed monster #4242 not found/);
    const question = firstScreenIndex(screens, /Will you accept .*leash named a keepsa\.\.\.\?/s);
    assert.ok(diagnostic < question, 'the diagnostic precedes the shortened credit offer');
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
    assert.equal(leash.leashmon, 0);
    assert.equal(leash.oextra?.oname, name);
    assert.equal(leash.where, 'floor');
    assert.equal(leash.no_charge, true);
    assert.equal(shopkeeper.eshk.credit ?? 0, 0);
});

void test('dip reports a missing leash once before shortening its long name', async () => {
    const level = freshPlayableRoom({ flags: { verbose: true } });
    level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    game.storage = memoryStorage();
    const leash = await addInventoryObject(LEASH, {
        leashmon: 4242,
        oextra: { oname: 'a keepsake from the long journey through the mountains' },
    });
    const input = resetInputState();
    const screens = recordScreens(input);
    input.feed(`dip\n${leash.invlet}`);

    await rhack('#'.charCodeAt(0));

    const diagnostic = firstScreenIndex(screens, /leashed monster #4242 not found/);
    const question = firstScreenIndex(screens, /Dip the leash into the fountain\?/);
    assert.ok(diagnostic < question, 'the repair finishes before the shortened dip question');
    assert.equal(leash.leashmon, 0);
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
    assert.equal(game.context.move, 0, 'declining to dip leaves the leash in inventory');
    assert.equal(game.inventory.includes(leash), true);
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

void test('a hallucinated unpaid price is chosen only after its missing-bill report finishes', async () => {
    freshPlayableRoom({ hero: { hallucinationTurns: 10 } });
    const potion = await addInventoryObject(POT_HEALING, { unpaid: true, typeKnown: false });
    await createStaffedShop();
    game.u.ux = 11;
    game.u.uy = 11;
    const input = resetInputState();
    const screens: string[] = [];
    const currencyRolls = () => getRngLog().filter(call => call.startsWith('rn2(21)=')).length;
    input.display = {
        readKey(): Promise<number> {
            const screen = visibleText();
            screens.push(screen);
            assert.ok(screens.length <= 8, 'too many missing-bill key requests');
            if (screen.includes('--More--')) {
                // The final report line can remain pending until the menu.
                // Native completes the two earlier pagers before currency().
                if (!screen.includes('Please report these messages')) {
                    assert.equal(currencyRolls(), 0, 'pricing has not rolled a currency during the report');
                    assert.equal(priceQuoteSuffix(potion.otyp), '', 'the unfinished name has not taught a price');
                }
                return Promise.resolve(32);
            }
            assert.match(screen, /potion.*\(unpaid, 0 /);
            assert.equal(currencyRolls(), 1, 'the completed inventory name chooses its currency once');
            return Promise.resolve(27);
        },
    };
    enableRngLog();

    await rhack('i'.charCodeAt(0));

    firstScreenIndex(screens, /unpaid_cost: object wasn't on any bill\./);
    assert.equal(currencyRolls(), 1);
});

void test('inventory naming diagnostics refresh changed hit points before their pagers', async () => {
    freshPlayableRoom({ hero: { uhp: 12, uhpmax: 20 } });
    await addInventoryObject(LEASH, { leashmon: 4242 });
    await bot();
    await loseHeroHp(5, 'a blow');
    const screens = recordScreens();

    await rhack('i'.charCodeAt(0));

    firstScreenIndex(screens, /leashed monster #4242 not found/);
    const reports = screens.filter(screen => screen.includes('--More--'));
    assert.ok(reports.length > 0, 'the naming diagnostic has an acknowledgment pager');
    for (const screen of reports)
        assert.match(screen.split('\n')[23] ?? '', /HP:7\(20\)/,
            'diagnostic prose flushes the current HP before inventory selection disables status');
});

for (const panic of [false, true]) {
    void test(`known unpaid contents ${panic ? 'panic on' : 'report'} a missing leash before a later missing bill`, async () => {
        freshPlayableRoom({ flags: { menu_style: 0 } });
        game.storage = memoryStorage();
        const bag = await addInventoryObject(SACK, { initialize: false, cknown: true });
        const potion = await knownObject(POT_HEALING);
        await addCreatedObjectToContainer(bag, potion);
        const leash = await knownObject(LEASH, { leashmon: 4242 });
        // add_to_container prepends: the billed leash precedes the unbilled potion.
        await addCreatedObjectToContainer(bag, leash);
        leash.unpaid = true;
        potion.unpaid = true;
        await createStaffedShop({ bill: [{ bo_id: leash.o_id, bquan: 1, price: 20, useup: false }] });
        game.flags.debug_fuzzer = panic ? FUZZER_IMPOSSIBLE_PANIC : 0;
        const input = resetInputState();
        const screens = recordScreens(input);
        input.feed('u');

        if (panic) {
            await assert.rejects(rhack('I'.charCodeAt(0)), {
                name: 'PanicTermination', message: 'leashed monster #4242 not found',
            });

            assert.equal(leash.leashmon, 4242, 'the panic stops naming before the leash is detached');
            assert.deepEqual(loggedReasons(), [
                'leashed monster #4242 not found', 'leashed monster #4242 not found',
            ], 'native logs both impossible() and the terminal panic');
        } else {
            await rhack('I'.charCodeAt(0));

            const missingLeash = firstScreenIndex(screens, /leashed monster #4242 not found/);
            const missingBill = firstScreenIndex(screens, /unpaid_cost: object wasn't on any bill\./);
            const menu = firstScreenIndex(screens, /an uncursed leash/);
            assert.ok(missingLeash < missingBill && missingBill < menu,
                `expected leash report, bill report, menu; got screens ${missingLeash}, ${missingBill}, ${menu}`);
            assert.equal(leash.leashmon, 0);
            assert.deepEqual(loggedReasons(), [
                'leashed monster #4242 not found', "unpaid_cost: object wasn't on any bill.",
            ]);
        }
    });
}

void test('a leash attached to a dead monster reports that monster as not found', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    pet.mhp = 0;
    pet.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: pet.m_id });
    recordScreens();

    await rhack('i'.charCodeAt(0));

    assert.deepEqual(loggedReasons(), [`leashed monster #${pet.m_id} not found`]);
    assert.equal(leash.leashmon, 0);
    assert.equal(pet.mleashed, 1, 'naming repairs the leash without changing the dead monster');
});

void test('a naming report and a later impossible() both complete', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    const screens = recordScreens();

    await inventoryItemDescription(leash);
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

for (const problem of ['missing leash', 'missing bill']) {
    void test(`Escape during a ${problem} report suppresses the singleton choice`, async () => {
        freshPlayableRoom();
        game.program_state.something_worth_saving = true;
        const item = problem === 'missing leash'
            ? await addInventoryObject(LEASH, { leashmon: 4242 })
            : await addInventoryObject(POT_HEALING, { unpaid: true });
        const input = resetInputState();
        const screens: string[] = [];
        input.display = {
            readKey(): Promise<number> {
                const screen = visibleText();
                screens.push(screen);
                assert.ok(screens.length <= 8, 'too many singleton key requests');
                return Promise.resolve(screen.includes('Program in disorder!') ? 27 : 32);
            },
        };

        const selected = await selectInventoryObject({ letters: item.invlet });

        firstScreenIndex(screens, problem === 'missing leash'
            ? /leashed monster #4242 not found/ : /unpaid_cost: object wasn't on any bill\./);
        firstScreenIndex(screens, /Program in disorder!/);
        assert.equal(selected.key, 0);
        assert.doesNotMatch(screens.join('\n'), /[a-z] - an uncursed/,
            'the stopped message window does not draw or ask about the choice');
        await plineWithContinuation('You keep your belongings.');
        await flush_screen(1);
        assert.match(visibleText(), /You keep your belongings\./,
            'finishing the singleton restores ordinary output');
    });
}

void test('container contents report a missing leash before displaying the window after Escape', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    game.program_state.something_worth_saving = true;
    const sack = await addInventoryObject(SACK, { initialize: false });
    const leash = await knownObject(LEASH, { leashmon: 4242 });
    await addCreatedObjectToContainer(sack, leash);
    const input = resetInputState();
    input.feed('\x1b');
    await moreUntilDismissed('You set aside the earlier message.');
    const screens = recordScreens(input);

    await containerContents([sack], false, false, true);

    const diagnostic = firstScreenIndex(screens, /leashed monster #4242 not found/);
    const contents = firstScreenIndex(screens, /Contents of the sack:/);
    assert.ok(diagnostic < contents, 'the diagnostic finishes before the contents need acknowledgment');
    assert.match(screens[contents] ?? '', /an uncursed leash/);
    assert.doesNotMatch(screens[diagnostic] ?? '', /Contents of the sack:/,
        'the contents window has not been painted during the report');
    assert.doesNotMatch(screens[contents] ?? '', /leashed monster|Program in disorder|Please report/);
    assert.equal(leash.leashmon, 0);
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
});

void test('a single shop leash quote reports and repairs its missing attachment once', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    await createStaffedShop();
    const leash = await floorObject(LEASH, game.u.ux, game.u.uy, { leashmon: 4242 });
    const screens = recordScreens();

    const quoted = await quoteShopGoods();

    assert.equal(quoted, true);
    firstScreenIndex(screens, /leashed monster #4242 not found/);
    assert.deepEqual(loggedReasons(), ['leashed monster #4242 not found']);
    assert.equal(leash.leashmon, 0);
    assert.match(game._pending_message, /"An uncursed leash, price \d+ zorkmids[,.]/);
    assert.doesNotMatch(game._pending_message, /attached to/);
});

void test('impossible() panic mode stops the leash formatter before it detaches the leash', async () => {
    freshPlayableRoom();
    game.storage = memoryStorage();
    game.flags.debug_fuzzer = FUZZER_IMPOSSIBLE_PANIC;
    const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
    recordScreens();

    await assert.rejects(rhack('i'.charCodeAt(0)), PanicTermination);

    assert.equal(leash.leashmon, 4242);
    assert.deepEqual(loggedReasons(), [
        'leashed monster #4242 not found', 'leashed monster #4242 not found',
    ], 'native logs both impossible() and the terminal panic');
});
