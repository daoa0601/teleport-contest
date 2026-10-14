import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';

void test('the gold command reports shop credit and usage debt after the wallet', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Ada';
    shopkeeper.eshk.credit = 12;
    shopkeeper.eshk.debit = 25;
    setHeroGoldAmount(game, 30);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await withMessagePages(() => rhack('$'.charCodeAt(0)), input,
        /wallet|credit|owe Ada/, 3);
    messages.push(game._pending_message);

    assert.match(messages.join('\n'), /12 zorkmids credit at Ada's general store\./);
    assert.match(messages.join('\n'), /You owe Ada 25 zorkmids\./);
    assert.equal(game.context.move, 0);
    assert.equal(shopkeeper.eshk.credit, 12);
    assert.equal(shopkeeper.eshk.debit, 25);
});
