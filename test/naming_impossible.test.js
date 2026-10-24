import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { PANICLOG } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEASH, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
function visibleText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
function loggedReasons() {
    return (game.storage?.getItem(PANICLOG) || '').split('\n').filter(Boolean).map(line => {
        const record = JSON.parse(line);
        assert.ok(record && typeof record === 'object' && 'reason' in record
            && typeof record.reason === 'string');
        return record.reason;
    });
}
// Answer every key request, recording each screen the hero is asked about.
function recordScreens() {
    const screens = [];
    const input = resetInputState();
    input.display = {
        readKey() {
            const screen = visibleText();
            screens.push(screen);
            assert.ok(screens.length <= 16, 'too many key requests');
            return Promise.resolve(screen.includes('--More--') ? 32 : 27);
        },
    };
    return screens;
}
function firstScreenIndex(screens, pattern) {
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
//# sourceMappingURL=naming_impossible.test.js.map