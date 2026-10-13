import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { glyphAt } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { makeBlinded } from '../js/sight_change.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an unseen pet is discovered by contact instead of displaced', async () => {
    freshObjectRoom();
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(kitten);
    await makeBlinded(5, { talk: false });
    await rhack('l'.charCodeAt(0));
    assert.equal(game._pending_message, "Wait!  There's something there you can't see!");
    assert.equal(game.u.ux, 10);
    assert.equal(kitten.mx, 11);
    assert.equal(glyphAt(11, 10)?.kind, 'invisible');
});
//# sourceMappingURL=pet_visibility_displacement.test.js.map