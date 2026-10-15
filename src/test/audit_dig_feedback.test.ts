import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { DOOR, D_CLOSED, D_BROKEN, HWALL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('fumbling a digging swing names the broad side of the tool', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = HWALL;
    const pick = await addInventoryObject(PICK_AXE, { spe: 0, owornmask: W_WEP });
    game.uwep = game.u.uwep = pick;
    game.u.fumbling = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|Bang|pick/, limit: 10 });
    input.feed(`${pick.invlet}l`);
    await rhack('a'.charCodeAt(0));
    initRng(12n);

    await continueCountedCommand();

    assert.equal(game._pending_message, 'Bang!  You hit with the broad side of the pick-axe!');
    assert.equal(level.requireAt(11, 10).typ, HWALL);
    assert.equal(game._occupation, null);
});

void test('breaking a door uses the simple tool name even when the pick has a personal name', async () => {
    const level = freshObjectRoom();
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const pick = await addInventoryObject(PICK_AXE, {
        spe: 0, oname: 'Basalt', owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = pick;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|door/, limit: 10 });
    input.feed(`${pick.invlet}l`);

    await rhack('a'.charCodeAt(0));
    for (let swing = 0; game._occupation && swing < 20; swing++)
        await continueCountedCommand();

    assert.equal(door.doormask, D_BROKEN);
    assert.equal(game._pending_message, 'You break through the door with your pick-axe.');
});

void test('a fumbling pick that cannot be dropped reveals its curse', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = HWALL;
    const pick = await addInventoryObject(PICK_AXE, {
        spe: 0, cursed: true, bknown: false, owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = pick;
    game.u.fumbling = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|Ouch|pick/, limit: 10 });
    input.feed(`${pick.invlet}l`);
    await rhack('a'.charCodeAt(0));
    initRng(3n);

    await continueCountedCommand();

    assert.equal(game.uwep, pick);
    assert.equal(pick.bknown, true);
    assert.equal(game.u._woundedLegSide, 'right');
    assert.equal(game._occupation, null);
});
