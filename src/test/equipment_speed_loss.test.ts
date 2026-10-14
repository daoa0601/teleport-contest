import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import type { GameObject } from '../js/object_types.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('speed boots announce slowing to intrinsic speed when taken off', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('fast', 'outside');
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('speed boots'), { known: false });
    await dress('W', boots);

    const messages = await dress('T', boots);

    assert.equal(game.u.fast, true);
    assert.equal(game.u.veryFast, false);
    assert.match(messages, /You feel yourself slow down a bit\./);
});

void test('a timed speed effect keeps the hero very fast after speed boots come off', async () => {
    freshObjectRoom();
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('speed boots'), { known: false });
    await dress('W', boots);
    setPropertyTimeout('fast', 30);

    const messages = await dress('T', boots);

    assert.equal(game.u.veryFast, true);
    assert.doesNotMatch(messages, /slow down/);
});

void test('losing blue dragon armor announces the loss of its extra speed', async () => {
    freshObjectRoom();
    const scales = await addInventoryObject(OBJECT_NAMES.indexOf('blue dragon scales'), { known: false });
    await dress('W', scales);

    const messages = await dress('T', scales);

    assert.equal(game.u.veryFast, false);
    assert.match(messages, /You slow down\./);
});

async function dress(command: 'W' | 'T', object: GameObject): Promise<string> {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${object.invlet}                      \x1b\x1b`);
    await rhack(command.charCodeAt(0));
    for (let turn = 0; turn < 40; turn++) {
        await moveloop_core();
        if (command === 'W' ? object.known : !object.worn) break;
    }
    assert.equal(command === 'W' ? object.known : !object.worn, true, 'the dressing action must finish');
    return [...messages, game._pending_message].join(' ');
}
