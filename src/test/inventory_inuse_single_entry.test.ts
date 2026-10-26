import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { W_ARMF } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshObjectRoom } from './support/object-room.js';

const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');

// C invent.c:display_pickinv() only assigns orderclass (and therefore the
// "Wielded/Readied Weapons" style headings) when sortloot() actually runs
// its comparison.  A single in-use entry keeps orderclass 0, so the
// "Inventory in use" menu lists it without any class heading.
void test('a lone wielded weapon is listed without a class heading', async t => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger, game);
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Inventory in use[\s\S]*dagger \(weapon in right hand\)/, keys: '\x1b' },
    ]);
    await rhack('*'.charCodeAt(0));
    assert.match(menu, /Inventory in use/);
    assert.doesNotMatch(menu, /Wielded\/Readied Weapons|Worn Armor|Miscellaneous/);
    assert.equal(game.context.move, 0);
});

// With more than one entry, sortloot() runs, every entry is classified, and
// each group renders under its heading (weapons before armor).
void test('wielded weapon plus worn boots produce both class headings', async t => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger, game);
    const boots = await addInventoryObject(LOW_BOOTS, { owornmask: W_ARMF });
    boots.worn = true;
    game.uarmf = boots;
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Inventory in use[\s\S]*Wielded\/Readied Weapons[\s\S]*dagger[\s\S]*Worn Armor[\s\S]*low boots/, keys: '\x1b' },
    ]);
    await rhack('*'.charCodeAt(0));
    assert.match(menu, /Wielded\/Readied Weapons/);
    assert.match(menu, /Worn Armor/);
});
