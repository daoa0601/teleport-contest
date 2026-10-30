import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, POT_HEALING } from '../js/object_data.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { startLuaCore } from './support/lua-game.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createStaffedShop } from './support/shop.js';

void test('a refused inventory throw leaves its object letter as a movement prefix', async () => {
    await freshObjectRoom();
    installPolymorphedHero('acid blob');
    const potion = await addInventoryObject(POT_HEALING, { invlet: 'g' });
    const input = resetInputState();
    input.feed(`${potion.invlet}t`);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.equal(game._pending_message, "You can't throw or shoot without hands.");

    input.feed('.');
    await rhack(0);

    assert.equal(game._pending_message, "The 'g' prefix should be followed by a movement command.");
    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.includes(potion), true);
});

void test('an unaffordable inventory purchase leaves its object letter as a menu prefix', async () => {
    await freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { invlet: 'm', unpaid: true });
    await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 100, useup: false },
    ] });
    setHeroGoldAmount(game, 1);
    const input = resetInputState();
    input.feed(`${dagger.invlet}p`);
    await rhack('i'.charCodeAt(0));
    await rhack(0);
    assert.match(game._pending_message, /don't have enough gold/);
    const pages: string[] = [];
    input.beforeRead = () => { pages.push(game._pending_message); };

    input.feed('#force\n ');
    await rhack(0);

    assert.ok(pages.some(message => message === "'m' prefix has no effect for the force command."), pages.join('\n'));
    assert.equal(game._pending_message, "You can't force anything when not wielding a weapon.");
    assert.equal(game.context.move, 0);
});

void test('failed inventory engraving leaves the next player command available', async () => {
    const level = await freshObjectRoom();
    level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'E' },
    ]);
    await rhack(0);
    assert.equal(game._pending_message, "You can't write on the fountain!");

    input.feed('s');
    await answerPrompts(rhack(0), input, []);

    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(dagger), true);
});

void test('an unread end-turn message does not consume an inventory drop choice', async t => {
    const input = freshTurnRoom();
    const dagger = await addInventoryObject(DAGGER);
    const core = await startLuaCore(t);
    core.execute(`
        function after_inventory()
            if not considered then
                nh.pline("You consider your possessions.")
                considered = true
            end
            return true
        end
        nh.callback("end_turn", "after_inventory")
    `);
    input.feed('i');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'd' },
    ]);
    assert.match(game._pending_message, /You consider your possessions/);

    await answerPrompts(moveloop_core(), input, []);

    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(dagger.where, 'floor');
});
