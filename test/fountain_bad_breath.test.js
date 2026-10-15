import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('bad breath from a fountain makes every living monster flee without announcing flight', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const jackal = await createMonsterAt('jackal', 11, 10);
    const distant = await createMonsterAt('newt', 16, 14);
    const dead = await createMonsterAt('goblin', 12, 10);
    dead.mhp = 0;
    dead.dead = true;
    resetInputState().feed('y' + ' '.repeat(10));
    initRng(42n);
    await rhack('q'.charCodeAt(0));
    assert.equal(jackal.mflee, 1);
    assert.equal(distant.mflee, 1);
    assert.equal(jackal.mfleetim, 0);
    assert.equal(!!dead.mflee, false);
    assert.match(game._pending_message, /This water gives you bad breath!/);
    assert.doesNotMatch(game._pending_message, /turns to flee/);
});
//# sourceMappingURL=fountain_bad_breath.test.js.map