import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { BAG_OF_HOLDING, OILSKIN_SACK } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';

for (const [type, name] of [[OILSKIN_SACK, 'oilskin sack'], [BAG_OF_HOLDING, 'bag of holding']] as const) {
    void test(`an empty carried ${name} keeps its name and ownership in the action prompt`, async () => {
        freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        const bag = await addInventoryObject(type, { initialize: false, cknown: true });
        const input = resetInputState();

        await answerPrompts(applyInventoryObject(bag), input, [
            { prompt: new RegExp(`Your ${name} is empty\\.  Do what with it\\?`), keys: 'q' },
        ]);

        assert.equal(game.context.move, 0);
    });
}

void test('opening a named bag uses its personal name, but empty feedback uses its simple owned name', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        initialize: false, cknown: false, oextra: { oname: 'Supplies' },
    });
    const input = resetInputState();

    await answerPrompts(applyInventoryObject(bag), input, [
        { prompt: /Do what with your bag of holding named Supplies\?/, keys: 'o' },
    ]);

    assert.equal(game._pending_message, 'Your bag of holding is empty.');
    assert.equal(bag.cknown, true);
    assert.equal(game.context.move, 1);
});

void test('an empty floor bag uses the floor ownership prefix', async () => {
    freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    await floorObject(OILSKIN_SACK, 10, 10, { initialize: false, cknown: true });
    const input = resetInputState();

    await answerPrompts(runExtendedCommand('loot'), input, [
        { prompt: /The oilskin sack is empty\.  Do what with it\?/, keys: 'q' },
    ]);

    assert.equal(game.context.move, 0);
});

for (const cknown of [false, true]) {
    void test(`a long named and called bag preserves its ${cknown ? 'empty' : 'ordinary'} question`, async () => {
        freshPlayableRoom({ flags: { menu_style: MENU_TRADITIONAL } });
        const personalName = 'Travel supplies '.repeat(4).slice(0, 63);
        const callName = 'Waterproof luggage '.repeat(3);
        const bag = await addInventoryObject(OILSKIN_SACK, {
            initialize: false, cknown, known: false, typeKnown: false,
            oextra: { oname: personalName },
        });
        game._objectCallNames = { [OILSKIN_SACK]: callName };
        const input = resetInputState();

        await answerPrompts(applyInventoryObject(bag), input, [
            { prompt: cknown
                ? /Your bag called Waterpro\.\.\. named[\s\S]*is empty\.  Do what with it\?/
                : /Do what with your bag called Waterpro\.\.\. named[\s\S]*\?/,
            keys: 'q' },
        ]);

        assert.equal(bag.oextra?.oname, personalName);
        assert.equal(game._objectCallNames[OILSKIN_SACK], callName);
        assert.equal(game.context.move, 0);
    });
}
