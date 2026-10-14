import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_TRADITIONAL, W_SWAPWEP } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { DAGGER, POT_HEALING, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

for (const contents of ['known', 'unknown', 'empty'] as const) {
    void test(`traditional payment names a billed sack with ${contents} contents without offering owned contents`, async () => {
        freshObjectRoom();
        const sack = await addInventoryObject(SACK, { cknown: contents !== 'unknown', unpaid: true });
        if (contents !== 'empty') await addCreatedObjectToContainer(sack, await knownObject(DAGGER));
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
        } finally {
            input.feed('n');
            await paying;
        }

        assert.equal(sack.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(heroGoldAmount(game), 10);
    });
}

for (const { quantity, alternate, label } of [
    { quantity: 1, alternate: false, label: 'one dagger' },
    { quantity: 2, alternate: false, label: 'two daggers' },
    { quantity: 2, alternate: true, label: 'two alternate daggers' },
]) {
    void test(`traditional payment preserves the price and question for ${label} with a long name`, async () => {
        freshObjectRoom();
        const name = 'the long and winding road through mountains to the distant sea';
        const dagger = await addInventoryObject(DAGGER, {
            quan: quantity, unpaid: true, greased: true,
            oeroded: 3, oeroded2: 3, oextra: { oname: name },
            owornmask: alternate ? W_SWAPWEP : 0,
        });
        if (alternate) game.uswapwep = dagger;
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: quantity, price: 4, useup: false },
        ] });
        game.flags.menu_style = MENU_TRADITIONAL;
        setHeroGoldAmount(game, 10);
        const input = resetInputState();

        const paying = rhack('p'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            const prompt = game._pending_message;
            if (alternate) assert.match(prompt, /^daggers for 8 zorkmids\.  Pay\?/);
            else {
                assert.match(prompt, /greased thoroughly rusty thoroughly corroded/);
                assert.match(prompt, /daggers? named the long\.\.\./);
                assert.match(prompt, new RegExp(`for ${4 * quantity} zorkmids\\.  Pay\\?`));
            }
            assert.match(prompt, /\[yn\] \(n\)/);
        } finally {
            input.feed('n');
            await paying;
        }

        assert.equal(dagger.oextra?.oname, name);
        assert.equal(dagger.greased, true);
        assert.equal(dagger.oeroded, 3);
        assert.equal(dagger.oeroded2, 3);
        assert.equal(dagger.quan, quantity);
        assert.equal(dagger.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(heroGoldAmount(game), 10);
        assert.equal(game.context.move, 0);
    });
}

for (const { personalName, label, expected } of [
    { personalName: 'second label', label: 'a short personal name',
        expected: /named second label for 4 zorkmids\.  Pay\?/ },
    { personalName: 'a second long winding road through mountains to distant seas',
        label: 'a long personal name', expected: /named a second\.\.\. for 4 zorkmids\.  Pay\?/ },
]) {
    void test(`traditional payment shortens a long call name beside ${label}`, async () => {
        freshObjectRoom();
        const callName = 'the long and winding road through mountains to the distant sea';
        const potion = await addInventoryObject(POT_HEALING, {
            known: false, typeKnown: false, unpaid: true, greased: true,
            oextra: { oname: personalName },
        });
        game._objectCallNames = { [POT_HEALING]: callName };
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: potion.o_id, bquan: 1, price: 4, useup: false },
        ] });
        game.flags.menu_style = MENU_TRADITIONAL;
        setHeroGoldAmount(game, 10);
        const input = resetInputState();

        const paying = rhack('p'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            assert.match(game._pending_message, /potion called the long\.\.\. named /);
            assert.match(game._pending_message, expected);
        } finally {
            input.feed('n');
            await paying;
        }

        assert.equal(game._objectCallNames[POT_HEALING], callName);
        assert.equal(potion.oextra?.oname, personalName);
        assert.equal(potion.greased, true);
        assert.equal(potion.unpaid, true);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(heroGoldAmount(game), 10);
    });
}
