import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { A_STR, DOOR, HWALL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('an increase-damage bonus helps an applied pick break a wall sooner', async () => {
    const level = freshObjectRoom();
    const pick = await addInventoryObject(PICK_AXE, { spe: 0, owornmask: W_WEP });
    game.uwep = game.u.uwep = pick;
    game.u.udaminc = 100;
    level.requireAt(11, 10).typ = HWALL;
    const input = resetInputState();
    installPagerInput(input, { expected: /dig|wall/, limit: 10 });
    input.feed(`${pick.invlet}l`);

    await rhack('a'.charCodeAt(0));
    await continueCountedCommand();

    assert.equal(level.requireAt(11, 10).typ, DOOR);
    assert.equal(game._occupation, null);
    assert.equal(game.context.move, 1);
});

for (const strength of [68, 118]) {
    void test(`exceptional strength ${strength} helps an applied pick finish a wall`, async () => {
        const level = freshObjectRoom();
        // Native Strength stores 18/xx as 18 + xx.
        game.u.acurr = { a: [strength, 12, 12, 12, 12, 12] };
        const pick = await addInventoryObject(PICK_AXE, {
            spe: strength === 68 ? 89 : 88, owornmask: W_WEP,
        });
        game.uwep = game.u.uwep = pick;
        level.requireAt(11, 10).typ = HWALL;
        const input = resetInputState();
        installPagerInput(input, { expected: /dig|wall/, limit: 10 });
        input.feed(`${pick.invlet}l`);
        await rhack('a'.charCodeAt(0));
        initRng(1n);

        await continueCountedCommand();

        assert.equal(level.requireAt(11, 10).typ, DOOR);
        assert.equal(game._occupation, null);
    });
}
