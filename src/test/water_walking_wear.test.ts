import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WATER_WALKING_BOOTS } from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('water-walking boots lift a submerged hero and identify themselves at dressing completion', async () => {
    const level = freshObjectRoom();
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    game.u.uinwater = 1;
    game.underwater = true;
    grantIntrinsicProperty('magicalBreathing', 'outside');
    const boots = await addInventoryObject(WATER_WALKING_BOOTS, { known: false, typeKnown: false });

    const messages = await dress('W', boots);

    assert.equal(game.u.uinwater, 0);
    assert.equal(game.underwater, false);
    assert.equal(objectTypeKnown(boots), true);
    assert.match(messages, /You slowly rise above the surface\./);
});

async function dress(command: 'W' | 'T', object: GameObject): Promise<string> {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${object.invlet}                       \x1b`);
    await rhack(command.charCodeAt(0));
    for (let turn = 0; turn < 20; turn++) {
        await moveloop_core();
        if (command === 'W' ? object.known : !object.worn) break;
    }
    return [...messages, game._pending_message].join(' ');
}
