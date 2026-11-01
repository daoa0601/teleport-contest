// C wield.c:do_wield() and do_wear.c:armor_rw() guard two-handed refusals
// with bimanual(), which requires WEAPON_CLASS or TOOL_CLASS. Bulky armor
// (plate mail, dragon scales, ...) only shares the underlying oc_big bit,
// so wielded armor never blocks the shield hand in either direction.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flushPendingTopline } from '../js/tty_topline.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { OBJECT_NAMES, SMALL_SHIELD, TWO_HANDED_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/wield.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

const PLATE_MAIL = OBJECT_NAMES.indexOf('plate mail');

void test('a hero wearing a shield can wield bulky armor, spending a turn', async () => {
    await freshObjectRoom({ role: 'rogue' });
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, {
        expected: /wield|plate|hand|weapon/i,
        limit: 30,
    });
    input.beforeRead = () => { messages.push(game._pending_message); };
    const plate = await addInventoryObject(PLATE_MAIL);
    const shield = await addInventoryObject(SMALL_SHIELD);
    game.uarms = game.u.uarms = shield;

    pushKeys(plate.invlet);
    await rhack('w'.charCodeAt(0));
    const seen = `${game._pending_message}\n${messages.join('\n')}`;
    await flushPendingTopline();

    assert.equal(game.uwep, plate);
    assert.equal(game.context.move, 1);
    assert.match(seen, /- an uncursed \+0 plate mail \(wielded\)\./);

});

void test('a hero wearing a shield still cannot wield a two-handed sword', async () => {
    await freshObjectRoom({ role: 'rogue' });
    resetInputState();
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    const shield = await addInventoryObject(SMALL_SHIELD);
    game.uarms = game.u.uarms = shield;

    pushKeys(sword.invlet);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep ?? null, null);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You cannot wield a two-handed sword while wearing a shield.');
});

void test('a hero wielding bulky armor can still put on a shield', async () => {
    await freshObjectRoom();
    const plate = await addInventoryObject(PLATE_MAIL);
    const shield = await addInventoryObject(SMALL_SHIELD);
    await setPrimaryWeapon(plate);
    pushKey(shield.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game.uarms, shield);
    assert.equal(game.uwep, plate, 'The wielded armor keeps the weapon hand');
    assert.equal(game.uarm ?? null, null);
    assert.equal(game.context.move, 1);
});
