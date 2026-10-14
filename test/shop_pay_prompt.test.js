import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const contents of ['known', 'unknown', 'empty']) {
    void test(`traditional payment names a billed sack with ${contents} contents without offering owned contents`, async () => {
        freshObjectRoom();
        const sack = await addInventoryObject(SACK, { cknown: contents !== 'unknown', unpaid: true });
        if (contents !== 'empty')
            await addCreatedObjectToContainer(sack, await knownObject(DAGGER));
        const { shopkeeper } = await createStaffedShop({ bill: [
                { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
            ] });
        game.flags.menu_style = MENU_TRADITIONAL;
        setHeroGoldAmount(game, 10);
        const input = resetInputState();
        const paying = rhack('p'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            const prompt = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(prompt, contents === 'known' ? /sack containing 1 item for 2 zorkmids\.  Pay\?/
                : contents === 'empty' ? /empty.*sack for 2 zorkmids\.  Pay\?/
                    : /sack for 2 zorkmids\.  Pay\?/);
            assert.doesNotMatch(prompt, /and its contents|unpaid/);
        }
        finally {
            input.feed('n');
            await paying;
        }
        assert.equal(sack.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(heroGoldAmount(game), 10);
    });
}
//# sourceMappingURL=shop_pay_prompt.test.js.map