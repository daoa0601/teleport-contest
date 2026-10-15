import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BELL_OF_OPENING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { installHeroChainedToBuriedBall } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a blessed opening bell announces levitation returning after freeing a buried ball', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('levitation', 'outside');
    const ball = await installHeroChainedToBuriedBall();
    const bell = await addInventoryObject(BELL_OF_OPENING, { spe: 2, blessed: true });
    const input = resetInputState();
    const messages: string[] = [];
    installPagerInput(input, { expected: /bell|float|open|chain/, limit: 10 });
    input.beforeRead = () => { messages.push(game._pending_message ?? ''); };
    input.feed(bell.invlet);

    await rhack('a'.charCodeAt(0));

    assert.equal(game.u.utrap, 0);
    assert.equal(ball.where, 'floor');
    assert.equal(game.u.levitating, true);
    assert.match([...messages, game._pending_message].join(' '), /You start to float in the air!/);
});
