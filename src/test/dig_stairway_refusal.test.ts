import assert from 'node:assert/strict';
import test from 'node:test';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { FOUNTAIN, SINK } from '../js/const.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

// C dig.c:dig_check() tests On_stairs(x, y) -- the stairway structure --
// rather than levl.typ.  A debug terrain wish can overwrite a staircase
// square with a sink, yet the stairway remains and digging downward must
// refuse there instead of bursting the sink's pipes.
void test('digging down refuses on a sink covering a stairway', async () => {
    freshObjectRoom();
    const sink = game.level?.requireAt(game.u.ux, game.u.uy);
    assert.ok(sink, 'hero must stand on the room floor');
    sink.typ = SINK;
    game.stairs = {
        sx: game.u.ux, sy: game.u.uy, up: false, isladder: false,
        u_traversed: false, tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
    game.uwep = game.u.uwep = pick;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|stairs|ladder|hard/, limit: 20 });
    input.feed(`${pick.invlet}>`);
    initRng(7n);

    await rhack('a'.charCodeAt(0));
    for (let swing = 0; game._occupation && swing < 20; swing++)
        await continueCountedCommand();

    assert.equal(game._pending_message, 'You start digging downward.  The stairs are too hard to dig in.');
    assert.equal(game.level?.at(game.u.ux, game.u.uy)?.typ, SINK,
        'the sink must survive; the pipes must not burst over a stairway');
    assert.ok(!game._occupation, 'the refused dig must not start an occupation.');
});

// The same refusal keeps a wished fountain intact over a ladder, and the
// ladder wording wins over the furniture name.
void test('digging down on a ladder reports the ladder refusal', async () => {
    freshObjectRoom();
    const square = game.level?.requireAt(game.u.ux, game.u.uy);
    assert.ok(square, 'hero must stand on the room floor');
    square.typ = FOUNTAIN;
    game.stairs = {
        sx: game.u.ux, sy: game.u.uy, up: true, isladder: true,
        u_traversed: false, tolev: { dnum: 0, dlevel: 0 }, next: null,
    };
    const pick = await addInventoryObject(PICK_AXE, { spe: 0 });
    game.uwep = game.u.uwep = pick;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|ladder|hard/, limit: 20 });
    input.feed(`${pick.invlet}>`);
    initRng(7n);

    await rhack('a'.charCodeAt(0));
    for (let swing = 0; game._occupation && swing < 20; swing++)
        await continueCountedCommand();

    assert.equal(game._pending_message,
        'You start digging downward.  The ladder resists your effort.');
    assert.equal(game.level?.at(game.u.ux, game.u.uy)?.typ, FOUNTAIN,
        'the fountain must survive the ladder refusal');
    assert.ok(!game._occupation, 'the refused dig must not start an occupation.');
});
