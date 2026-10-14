import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOUNTAIN } from '../js/const.js';
import { OIL_LAMP, POT_HEALING, RIN_PROTECTION, WAN_NOTHING, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('a potion item action drinks the selected potion while standing on a fountain', async (t) => {
    const level = freshObjectRoom({ hero: { uhp: 1 } });
    const square = level.at(game.u.ux, game.u.uy);
    assert.ok(square);
    square.typ = FOUNTAIN;
    const potion = await addInventoryObject(POT_HEALING);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Potions/, keys: potion.invlet },
        { prompt: /q - Quaff \(drink\) this potion/, keys: 'q' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.inventory.includes(potion), false);
    assert.ok((game.u.uhp ?? 0) > 1);
    assert.equal(game.context.move, 1);
});
void test('the apply action lights a carried oil lamp', async (t) => {
    freshObjectRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { age: 100, lamplit: false });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: lamp.invlet },
        { prompt: /a - Light this light source/, keys: 'a' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(lamp.lamplit, true);
    assert.equal(game.context.move, 1);
});
void test('a ring item action calls the selected type', async (t) => {
    freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION, { typeKnown: false });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Rings/, keys: ring.invlet },
        { prompt: /C - Call the type for/, keys: 'C' },
        { prompt: /Call an? .*ring:/, keys: 'Keepsake\r' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], 'Keepsake');
    assert.equal(game.context.move, 0);
});
void test('a wand item action zaps the selected wand', async (t) => {
    freshObjectRoom();
    const wand = await addInventoryObject(WAN_NOTHING, { spe: 3 });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Wands/, keys: wand.invlet },
        { prompt: /z - Zap this wand to release its magic/, keys: 'z' },
        { prompt: /In what direction\?/, keys: '.' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(wand.spe, 2);
    assert.equal(game.context.move, 1);
});
void test('an armor item action wears the selected boots', async (t) => {
    freshObjectRoom();
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('low boots'));
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Armor/, keys: boots.invlet },
        { prompt: /W - Wear this armor/, keys: 'W' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.uarmf, boots);
    assert.equal(game.context.move, 1);
});
void test('a lamp item action rubs the lamp without asking what to rub', async (t) => {
    freshObjectRoom();
    const lamp = await addInventoryObject(OIL_LAMP);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /Tools/, keys: lamp.invlet },
        { prompt: /R - Rub this oil lamp/, keys: 'R' },
    ]);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game.uwep, lamp);
    await rhack(0);
    assert.match(game._pending_message, /Nothing happens\./);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=inventory_action_commands.test.js.map