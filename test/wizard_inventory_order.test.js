import assert from 'node:assert/strict';
import test, {} from 'node:test';
import { rhack } from '../js/cmd.js';
import { clearMessageWindow } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { fullyIdentifyObject, objectNeedsFullIdentification } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { Engine } from '../js/jsmain.js';
import { FOOD_RATION, OIL_LAMP, POT_BLINDNESS, POT_HEALING, WAN_LIGHT, WAX_CANDLE } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function startWizard(t) {
    const engine = new Engine({
        seed: 731,
        datetime: '20000115090000',
        display: new GameDisplay(null),
        storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Sorter,role:wizard,race:human,gender:male,align:neutral,'
            + 'playmode:debug,!legacy,!tutorial,!news,!tips,pettype:none',
    });
    t.after(async () => { await engine.lua.destroy(); });
    installPagerInput(engine.inputGate, { expected: /Welcome|Hello|moon/, limit: 4 });
    assert.equal(await engine.start(), true);
    engine.inputGate.display = null;
    for (const object of engine.state.inventory)
        fullyIdentifyObject(object);
    clearMessageWindow();
}
async function wizardInventoryText() {
    const input = resetInputState();
    const command = rhack(9);
    try {
        await input.waitUntilBlocked();
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /Debug Identify/);
        return text;
    }
    finally {
        input.feed('\x1b');
        await command;
    }
}
void test('wizard identification lists lowercase candle slots before an uppercase lamp slot', async (t) => {
    await startWizard(t);
    const candle = await addInventoryObject(WAX_CANDLE, { invlet: 'v', bknown: false });
    const lamp = await addInventoryObject(OIL_LAMP, { invlet: 'A', bknown: false });
    const moves = game.moves;
    const text = await wizardInventoryText();
    assert.match(text, /v - .*wax candle[\s\S]*A - .*oil lamp/);
    assert.equal(objectNeedsFullIdentification(candle), true, 'cancelling leaves the candle unidentified');
    assert.equal(objectNeedsFullIdentification(lamp), true, 'cancelling leaves the lamp unidentified');
    assert.equal(game.moves, moves);
    assert.equal(game.context.move, 0);
});
void test('wizard identification lists an unnamed lowercase wand before a named uppercase wand', async (t) => {
    await startWizard(t);
    const unnamed = await addInventoryObject(WAN_LIGHT, { invlet: 'y', known: false, spe: 12 });
    const named = await addInventoryObject(WAN_LIGHT, {
        invlet: 'B', known: false, spe: 8, oextra: { oname: 'Beacon' },
    });
    const text = await wizardInventoryText();
    assert.match(text, /y - .*wand of light \(0:12\)[\s\S]*B - .*wand of light named Beacon \(0:8\)/);
    assert.equal(unnamed.known, false);
    assert.equal(named.known, false);
    assert.equal(named.oextra?.oname, 'Beacon');
    assert.equal(game.context.move, 0);
});
void test('wizard identification honors full loot ordering for tools instead of inventory letters', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    applyNethackrc('OPTIONS=sortloot:full');
    await addInventoryObject(WAX_CANDLE, { invlet: 'a', bknown: false });
    await addInventoryObject(OIL_LAMP, { invlet: 'b', bknown: false });
    const text = await wizardInventoryText();
    assert.match(text, /b - .*oil lamp[\s\S]*a - .*wax candle/);
});
void test('full wizard loot ordering ignores personal wand names and uses charge counts to break ties', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    applyNethackrc('OPTIONS=sortloot:full');
    const named = await addInventoryObject(WAN_LIGHT, {
        invlet: 'a', spe: 2, bknown: false, oextra: { oname: 'Beacon' },
    });
    await addInventoryObject(WAN_LIGHT, { invlet: 'b', spe: 7, bknown: false });
    const text = await wizardInventoryText();
    assert.match(text, /b - .*wand of light \(0:7\)[\s\S]*a - .*wand of light named Beacon \(0:2\)/);
    assert.equal(named.oextra?.oname, 'Beacon');
});
void test('full wizard loot ordering uses revealed names without discovering potion types', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    applyNethackrc('OPTIONS=sortloot:full');
    const healing = await addInventoryObject(POT_HEALING, { invlet: 'a', typeKnown: false });
    const blindness = await addInventoryObject(POT_BLINDNESS, { invlet: 'b', typeKnown: false });
    const text = await wizardInventoryText();
    assert.match(text, /b - .*potion of blindness[\s\S]*a - .*potion of healing/);
    assert.equal(objectTypeKnown(healing), false);
    assert.equal(objectTypeKnown(blindness), false);
});
void test('wizard identification without sortpack lists letters across classes without headings', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    applyNethackrc('OPTIONS=!sortpack');
    await addInventoryObject(OIL_LAMP, { invlet: 'a', bknown: false });
    await addInventoryObject(FOOD_RATION, { invlet: 'b', bknown: false });
    const text = await wizardInventoryText();
    assert.match(text, /a - .*oil lamp[\s\S]*b - .*food ration/);
    assert.doesNotMatch(text, /Tools|Comestibles/);
});
void test('wizard identification reassigns unfixed inventory letters before displaying objects', async () => {
    await freshObjectRoom({ flags: { debug: true, fixinv: false } });
    const lamp = await addInventoryObject(OIL_LAMP, { invlet: 'x', bknown: false });
    const candle = await addInventoryObject(WAX_CANDLE, { invlet: 'z', bknown: false });
    const text = await wizardInventoryText();
    assert.match(text, /a - .*oil lamp[\s\S]*b - .*wax candle/);
    assert.equal(lamp.invlet, 'a');
    assert.equal(candle.invlet, 'b');
});
//# sourceMappingURL=wizard_inventory_order.test.js.map