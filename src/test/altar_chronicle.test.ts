import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { ALTAR } from '../js/const.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { landObjectOnAltar } from '../js/altar_object.js';
import { DAGGER, POT_HEALING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the chronicle records the first altar drop before the altar reveals beatitude', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = ALTAR;
    const dagger = await addInventoryObject(DAGGER, { blessed: false, cursed: false, bknown: false, spe: 2 });
    const input = resetInputState();
    input.feed(dagger.invlet);
    await rhack('d'.charCodeAt(0));
    let text = '';
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('Logged events:')) text = screen;
    };
    input.feed(`#chronicle\n${' '.repeat(10)}`);
    await rhack(0);

    assert.match(text, /eschewed atheism, by dropping a \+2 dagger on an altar/);
    assert.doesNotMatch(text, /dropping an uncursed/);
});

void test('an unobserved potion gains its appearance before the first altar-drop event is named', async () => {
    freshObjectRoom();
    const potion = await addInventoryObject(POT_HEALING, {
        typeKnown: false, known: false, dknown: false, bknown: false, observed: false,
    });
    const input = resetInputState();
    await landObjectOnAltar(potion);
    let text = '';
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('Logged events:')) text = screen;
    };
    input.feed(`#chronicle\n${' '.repeat(10)}`);

    await rhack(0);

    assert.match(text, /eschewed atheism, by dropping an? [a-z -]+ potion on an altar/);
    assert.doesNotMatch(text, /dropping a potion on an altar/);
    assert.equal(potion.dknown, true);
});
