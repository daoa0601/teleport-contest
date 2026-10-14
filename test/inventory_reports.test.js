import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { W_ARMF, W_RINGL, W_RINGR } from '../js/const.js';
import { DAGGER, GOLD_PIECE, OBJECT_NAMES, OIL_LAMP, RIN_PROTECTION } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshObjectRoom } from './support/object-room.js';
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const RIN_STEALTH = OBJECT_NAMES.indexOf('stealth');
void test('the weapon report describes the wielded object and its enchantment', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { spe: 3 });
    await setPrimaryWeapon(dagger, game);
    await rhack(')'.charCodeAt(0));
    assert.match(game._pending_message, /\+3 dagger \(weapon in right hand\)/);
    assert.equal(game.context.move, 0);
});
void test('the armor report includes boots when no suit is worn', async () => {
    freshObjectRoom();
    const boots = await addInventoryObject(LOW_BOOTS, { spe: 2, owornmask: W_ARMF });
    game.uarmf = boots;
    await rhack('['.charCodeAt(0));
    assert.match(game._pending_message, /\+2 pair of low boots \(being worn\)/);
    assert.equal(game.context.move, 0);
});
void test('the ring report lists both worn rings and opens the selected item actions', async (t) => {
    freshObjectRoom();
    const left = await addInventoryObject(RIN_PROTECTION, { owornmask: W_RINGL });
    const right = await addInventoryObject(RIN_STEALTH, { owornmask: W_RINGR });
    game.uleft = left;
    game.uright = right;
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Inventory in use[\s\S]*Rings[\s\S]*ring of stealth[\s\S]*ring of protection/, keys: left.invlet },
        { prompt: /Do what with the ring of protection\?/, keys: '\x1b' },
    ]);
    await rhack('='.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('the tools report includes a lit lamp', async () => {
    freshObjectRoom();
    await addInventoryObject(OIL_LAMP, { lamplit: true });
    await rhack('('.charCodeAt(0));
    assert.match(game._pending_message, /oil lamp.*\(lit\)/);
    assert.equal(game.context.move, 0);
});
void test('the menu-prefixed gold report displays coins as ordinary inventory', async (t) => {
    freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 20 });
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Your wallet contains 20 zorkmids\.--More--/, keys: ' ' },
        { prompt: /\$ - 20 gold pieces/, keys: '\x1b' },
    ]);
    input.feed('$');
    await rhack('m'.charCodeAt(0));
    assert.doesNotMatch(menu, /Inventory in use|Miscellaneous/);
    assert.equal(game.context.move, 0);
});
void test('inventory in use includes empty hands beside an active tool', async (t) => {
    freshObjectRoom();
    await addInventoryObject(OIL_LAMP, { lamplit: true });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Inventory in use[\s\S]*bare hands \(no weapon\)[\s\S]*Miscellaneous[\s\S]*oil lamp/, keys: '\x1b' },
    ]);
    await rhack('*'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('typed inventory filters blessed items and preserves the chosen item action', async (t) => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    const dagger = await addInventoryObject(DAGGER, { blessed: true });
    await addInventoryObject(LOW_BOOTS);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: 'B' },
        { prompt: /Items known to be blessed:[\s\S]*dagger/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'd' },
    ]);
    await rhack('I'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=inventory_reports.test.js.map