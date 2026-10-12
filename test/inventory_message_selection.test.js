import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { GETOBJ_EXCLUDE, GETOBJ_SUGGEST, PICK_NONE } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { selectInventoryObject } from '../js/invent.js';
import { chooseInventoryObject, promptInventoryObject } from '../js/inventory_prompt.js';
import { ARROW, DAGGER, DART, FOOD_RATION, GOLD_PIECE, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
function screenText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('question-mark selection shows one suggested object on the message line', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    const food = await addInventoryObject(FOOD_RATION, { bknown: false });
    const input = resetInputState();
    const selected = await answerPrompts(chooseInventoryObject('eat', object => object.oclass === 7 ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE), input, [
        { prompt: /What do you want to eat\?/, keys: '?' },
        { prompt: /b - a food ration\.--More--/, keys: food.invlet },
    ]);
    assert.equal(selected, food);
    assert.equal(game.inventory.includes(food), true);
    assert.doesNotMatch(screenText(), /Comestibles|--More--/);
});
void test('dismissing a single suggestion repeats the object question', async () => {
    freshObjectRoom();
    const food = await addInventoryObject(FOOD_RATION, { bknown: false });
    const input = resetInputState();
    const selected = await answerPrompts(chooseInventoryObject('eat', () => GETOBJ_SUGGEST), input, [
        { prompt: /What do you want to eat\?/, keys: '?' },
        { prompt: /a - a food ration\.--More--/, keys: ' ' },
        { prompt: /What do you want to eat\?/, keys: food.invlet },
    ]);
    assert.equal(selected, food);
});
void test('Escape at a single suggestion cancels with normal Never mind feedback', async () => {
    freshObjectRoom();
    await addInventoryObject(FOOD_RATION, { bknown: false });
    const input = resetInputState();
    const selected = await answerPrompts(chooseInventoryObject('eat', () => GETOBJ_SUGGEST), input, [
        { prompt: /What do you want to eat\?/, keys: '?' },
        { prompt: /a - a food ration\.--More--/, keys: '\x1b' },
    ]);
    await flush_screen(1);
    assert.equal(selected, null);
    assert.match(screenText(), /Never mind\./);
});
void test('full inventory remains a window even when only one object is carried', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    const selected = await answerPrompts(selectInventoryObject(), input, [
        { prompt: /Weapons[\s\S]*\(end\)/, keys: dagger.invlet },
    ]);
    assert.equal(selected.key, dagger.invlet.charCodeAt(0));
});
void test('asterisk lists full inventory rather than treating its lone entry as a suggestion', async () => {
    freshObjectRoom();
    const food = await addInventoryObject(FOOD_RATION);
    const input = resetInputState();
    const selected = await answerPrompts(chooseInventoryObject('eat', () => GETOBJ_SUGGEST), input, [
        { prompt: /What do you want to eat\?/, keys: '*' },
        { prompt: /Comestibles[\s\S]*\(end\)/, keys: food.invlet },
    ]);
    assert.equal(selected, food);
});
for (const mode of ['forced inventory', 'menu prefix', 'wizard identification']) {
    void test(`${mode} keeps a single filtered item in a menu`, async () => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER);
        if (mode === 'forced inventory')
            game.flags.force_invmenu = true;
        else if (mode === 'menu prefix')
            game.iflags.menu_requested = true;
        else {
            game.flags.debug = true;
            game.iflags.override_ID = true;
        }
        const input = resetInputState();
        const selected = await answerPrompts(selectInventoryObject({ items: [dagger] }), input, [
            { prompt: /\(end\)/, keys: '\x1b' },
        ]);
        assert.equal(selected.key, 27);
    });
}
void test('a count entered before question mark survives single-item selection', async () => {
    freshObjectRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 8 });
    const input = resetInputState();
    const selected = await answerPrompts(promptInventoryObject('What do you want to drop? [a or ?*] ', game.inventory, { allowMenu: true, allowCount: true }), input, [
        { prompt: /What do you want to drop\?/, keys: '3?' },
        { prompt: /a - 8 [^\n]*arrows\.--More--/, keys: arrows.invlet },
    ]);
    assert.equal(selected.object, arrows);
    assert.equal(selected.count, 3);
    assert.equal(arrows.quan, 8);
});
void test('a nonselectable filtered item prints its description without asking for a key', async () => {
    freshObjectRoom();
    const food = await addInventoryObject(FOOD_RATION, { bknown: false });
    const input = resetInputState();
    const selected = await answerPrompts(selectInventoryObject({ items: [food], pickMode: PICK_NONE }), input, []);
    await flush_screen(1);
    assert.equal(selected.key, 0);
    assert.match(screenText(), /^a - a food ration\./);
    assert.doesNotMatch(screenText(), /--More--/);
});
void test('a wield menu offers empty hands alongside its one suggested weapon', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await answerPrompts(rhack('w'.charCodeAt(0)), input, [
        { prompt: /What do you want to wield\?/, keys: '?' },
        { prompt: /Miscellaneous[\s\S]*bare hands[\s\S]*Weapons/, keys: dagger.invlet },
    ]);
    assert.equal(game.uwep, dagger);
    assert.equal(game.context.move, 1);
});
void test('an inventory menu adds one selector prefix to its empty-hands description', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    const input = resetInputState();
    const selection = selectInventoryObject({ extraChoice: 'bare hands' });
    try {
        await input.waitUntilBlocked();
        const handsRow = requireGameDisplay().grid.find(row => row.map(cell => cell.ch).join('').includes('bare hands'));
        assert.ok(handsRow, 'the menu offers bare hands');
        assert.equal(handsRow.map(cell => cell.ch).join('').trim(), '- - bare hands');
    }
    finally {
        input.feed('-');
        assert.equal((await selection).key, '-'.charCodeAt(0));
    }
});
void test('empty hands can be selected from an otherwise empty inventory', async () => {
    freshObjectRoom();
    const input = resetInputState();
    await answerPrompts(rhack('w'.charCodeAt(0)), input, [
        { prompt: /What do you want to wield\?/, keys: '*' },
        { prompt: /- - your bare hands \(wielded\)\.--More--/, keys: '-' },
    ]);
    assert.equal(game.uwep, null);
    assert.equal(game.context.move, 0);
});
void test('an empty quiver suggests its lone missile without adding the downplayed empty choice', async () => {
    freshObjectRoom();
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    await answerPrompts(rhack('Q'.charCodeAt(0)), input, [
        { prompt: /What do you want to ready\? \[a or \?\*\]/, keys: '?' },
        { prompt: /a - [^\n]*dart\.--More--/, keys: dart.invlet },
    ]);
    assert.equal(game.uquiver, dart);
    assert.equal(game.context.move, 0);
});
void test('an occupied quiver offers its empty choice alongside one suggested missile', async () => {
    freshObjectRoom();
    const dart = await addInventoryObject(DART);
    game.uquiver = dart;
    const input = resetInputState();
    await answerPrompts(rhack('Q'.charCodeAt(0)), input, [
        { prompt: /What do you want to ready\? \[- a or \?\*\]/, keys: '?' },
        { prompt: /Miscellaneous[\s\S]*empty quiver[\s\S]*Weapons/, keys: '-' },
    ]);
    assert.equal(game.uquiver, null);
    assert.equal(game.context.move, 0);
});
void test('empty-quiver fire describes its extra choice as hands', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    await addInventoryObject(POT_HEALING);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /You have no ammunition readied\.--More--/, keys: ' ' },
        { prompt: /What do you want to fire\? \[\*\]/, keys: '?' },
        { prompt: /Miscellaneous[\s\S]*your hands[\s\S]*Potions/, keys: '-' },
    ]);
    assert.equal(game.uquiver, null);
    assert.equal(game.context.move, 0);
});
void test('wielding falls back to downplayed noncoin objects when no weapons are suggested', async () => {
    freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const food = await addInventoryObject(FOOD_RATION);
    const input = resetInputState();
    input.feed('?');
    const action = rhack('w'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        const menu = screenText();
        assert.match(menu, /Miscellaneous[\s\S]*bare hands[\s\S]*Comestibles/);
        assert.doesNotMatch(menu, /gold pieces|Coins/);
    }
    finally {
        input.feed(food.invlet);
        await action;
    }
    assert.equal(game.uwep, food);
});
//# sourceMappingURL=inventory_message_selection.test.js.map