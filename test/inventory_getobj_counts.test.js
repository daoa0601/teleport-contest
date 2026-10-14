import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { GETOBJ_EXCLUDE_INACCESS, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { chooseInventoryObject } from '../js/inventory_prompt.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('#adjust moves only the counted part of a stack', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 7 });
    const input = resetInputState();
    input.feed('adjust\r');
    planInput(input, t, [
        { prompt: /What do you want to adjust\?/, keys: `3${dagger.invlet}` },
        { prompt: /Split 3 to what/, keys: 'z' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(dagger.quan, 4);
    assert.equal(game.inventory.find(object => object.invlet === 'z')?.quan, 3);
    assert.equal(game.context.move, 0);
});
void test('counted #adjust reveals a wielded stack curse and moves the whole stack', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, {
        quan: 7, cursed: true, bknown: false, wielded: true, owornmask: W_WEP,
    });
    game.uwep = dagger;
    game.u.uwep = dagger;
    const input = resetInputState();
    input.feed('adjust\r');
    planInput(input, t, [
        { prompt: /What do you want to adjust\?/, keys: `3${dagger.invlet}` },
        { prompt: /Adjust letter to what/, keys: 'z' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(dagger.bknown, true, 'Trying to split a welded weapon reveals its curse');
    assert.equal(dagger.quan, 7);
    assert.equal(game.inventory.length, 1);
    assert.equal(game.inventory.find(object => object.invlet === 'z'), dagger);
    assert.equal(game.uwep, dagger);
    assert.match(game._pending_message, /Moving: z - 7 cursed .*daggers/);
    assert.equal(game.context.move, 0);
});
void test('zero typed before a drop letter means that no count was supplied', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 7 });
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What do you want to drop\?/, keys: `0${dagger.invlet}` }]);
    await rhack('d'.charCodeAt(0));
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(dagger.quan, 7);
    assert.equal(game.context.move, 1);
});
void test('a gold throw count leaves the rest of the purse carried', async (t) => {
    const level = freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 10 });
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /What do you want to throw\?/, keys: '3$' },
        { prompt: /In what direction\?/, keys: 'l' },
    ]);
    await rhack('t'.charCodeAt(0));
    assert.equal(heroGoldAmount(game), 7);
    const floor = level.objects.flatMap(column => (column ?? []).flatMap(pile => pile ?? []));
    assert.equal(floor.filter(object => object.otyp === GOLD_PIECE).reduce((sum, object) => sum + object.quan, 0), 3);
    assert.equal(game.context.move, 1);
});
for (const count of [2, 6]) {
    void test(`a forced throw menu rejects count ${count} and throws one of the selected stack`, async (t) => {
        const level = freshObjectRoom({ flags: { force_invmenu: true } });
        const dagger = await addInventoryObject(DAGGER, { quan: 4 });
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /What do you want to throw\?[\s\S]*Weapons[\s\S]*\(end\)/, keys: `${count}${dagger.invlet}` },
            { prompt: count > 4
                    ? /You only have 4 and can only throw one at a time\.--More--/
                    : /You can only throw one at a time\.--More--/, keys: ' ' },
            { prompt: /In what direction\?/, keys: 'l' },
        ]);
        await rhack('t'.charCodeAt(0));
        assert.equal(dagger.quan, 3);
        assert.equal(dagger.where, 'inventory');
        const floor = level.objects.flatMap(column => (column ?? []).flatMap(pile => pile ?? []));
        assert.equal(floor.filter(object => object.otyp === DAGGER).reduce((sum, object) => sum + object.quan, 0), 1);
        assert.equal(game.context.move, 1);
    });
}
void test('inaccessible possessions explain that there is nothing else suitable', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    const selected = await chooseInventoryObject('remove', () => GETOBJ_EXCLUDE_INACCESS);
    assert.equal(selected, null);
    assert.equal(game._pending_message, "You don't have anything else to remove.");
});
//# sourceMappingURL=inventory_getobj_counts.test.js.map