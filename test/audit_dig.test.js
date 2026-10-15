import assert from 'node:assert/strict';
import test from 'node:test';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { DOOR, HWALL, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
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
//# sourceMappingURL=audit_dig.test.js.map