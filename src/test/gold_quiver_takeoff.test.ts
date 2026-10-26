import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { freshTurnRoom } from './support/playable-room.js';

// C wield.c:setuqwep() clears the quiver when the last quivered coin leaves.
// hero_gold's zero/detach paths must clear both slot mirrors, or 'A' later
// offers a phantom Coins category (do_wear.c:doddoremarm "wearing nothing").
void test('throwing away quivered gold empties the quiver for the takeoff command', async () => {
    const input = freshTurnRoom({ role: 'barbarian', flags: { tips: false } });
    setHeroGoldAmount(game, 2);
    input.feed('Q$');
    await rhack(0);
    input.feed('fl');
    await rhack(0);
    input.feed('fl');
    await rhack(0);

    assert.equal(game.uquiver ?? game.u?.uquiver ?? null, null,
        'the emptied gold quiver must not linger in either slot mirror');
    input.feed('A');
    await rhack(0);

    assert.match(game._pending_message ?? '', /You are not wearing anything\./);
});
