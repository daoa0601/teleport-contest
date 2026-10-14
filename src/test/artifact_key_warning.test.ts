import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { BEAR_TRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { artifactObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the wielded Master Key warms when a nearby hidden trap enters its census', async () => {
    const level = freshObjectRoom({ role: 'rogue', hero: { ualign: { type: -1, record: 10 } } });
    requirePlayingGame(game);
    const key = await artifactObject('The Master Key of Thievery', { invlet: 'a', where: 'inventory' });
    game.inventory = [key];
    game._moveloopStarted = true;
    game.u.umovement = 12;
    addTrap(level, BEAR_TRAP, game.u.ux + 1, game.u.uy, { tseen: false });
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('wa .');

    await moveloop_core();
    await moveloop_core();

    assert.ok(messages.some(message => message.includes('The Key feels slightly warm.')),
        `Expected native trap warmth feedback: ${messages.join(' | ')}`);
});
