import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, TT_BEARTRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a mounted sit refusal names the saddled steed', async () => {
    freshObjectRoom();
    const pony = await createSaddledSteed('pony', { x: 10, y: 10 });
    game.u.usteed = pony;
    await runExtendedCommand('sit');
    assert.match(game._pending_message, /already sitting on the saddled pony/);
    assert.equal(game.context.move, 0);
});
void test('a trapped dragon cannot sit with its rear claw caught in the bear trap', async () => {
    const level = freshObjectRoom();
    installPolymorphedHero('red dragon');
    addTrap(level, BEAR_TRAP, 10, 10);
    game.u.utrap = 3;
    game.u.utraptype = TT_BEARTRAP;
    await runExtendedCommand('sit');
    assert.match(game._pending_message, /your rear claw in the bear trap/);
    assert.equal(game.u.utrap, 4);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=sit_form_messages.test.js.map