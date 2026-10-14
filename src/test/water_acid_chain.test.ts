import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_ACID } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('falling into water describes subsequent known acid bottles as another potion', async () => {
    const level = freshObjectRoom({ hero: { uluck: -13, swimming: true } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = POOL;
    const first = await addInventoryObject(POT_ACID, { blessed: true });
    const second = await addInventoryObject(POT_ACID, { cursed: true });
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        input.feed(' ');
    };
    initRng(1n);

    await rhack('l'.charCodeAt(0));

    messages.push(game._pending_message || '');
    assert.equal(first.where, 'gone');
    assert.equal(second.where, 'gone');
    assert.match(messages.join('\n'), /Another potion of acid explodes!/);
    assert.equal(game.u.uhp, 40);
});
