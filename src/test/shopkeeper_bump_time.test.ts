import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hack.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const { command, description, elapsed } of [
    { command: 'p', description: 'paying directly', elapsed: 0 },
    { command: 'l', description: 'bumping the shopkeeper', elapsed: 1 },
]) {
    void test(`${description} and declining a purchase ${elapsed ? 'takes a turn' : 'takes no time'}`, async () => {
        await freshObjectRoom({ flags: { verbose: true, safe_dog: true } });
        const dagger = await addInventoryObject(DAGGER, { unpaid: true });
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        ] });
        game.flags.menu_style = MENU_TRADITIONAL;
        setHeroGoldAmount(game, 10);
        resetInputState();
        pushKeys('n');

        await rhack(command.charCodeAt(0));

        assert.equal(game.context.move, elapsed);
        assert.equal(game.u.ux, 10, 'the hero stays beside the shopkeeper');
        assert.equal(shopkeeper.mx, 11);
        assert.equal(dagger.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(heroGoldAmount(game), 10);
    });

    void test(`${description} while the keeper naps ${elapsed ? 'takes a turn' : 'takes no time'}`, async () => {
        await freshObjectRoom({ flags: { verbose: true, safe_dog: true } });
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.msleeping = 1;
        resetInputState();

        await rhack(command.charCodeAt(0));

        assert.equal(game.context.move, elapsed);
        assert.equal(game.u.ux, 10, 'the sleeping keeper blocks the step');
        assert.equal(shopkeeper.mx, 11);
        assert.equal(shopkeeper.msleeping, 1);
        assert.match(game._pending_message, /seems to be napping|doesn't respond/);
    });
}
