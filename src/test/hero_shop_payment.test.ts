import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { DAGGER, GOLD_PIECE, SACK } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { planInput, withMessagePages } from './support/planned-input.js';

for (const buy of [false, true]) {
    void test(`${buy ? 'buying' : 'cancelling'} contained goods uses payment selection and spends time only for a purchase`, async (t) => {
        freshObjectRoom();
        const sack = await addInventoryObject(SACK, { cknown: true });
        const dagger = await knownObject(DAGGER);
        await addCreatedObjectToContainer(sack, dagger);
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        ] });
        dagger.unpaid = true;
        setHeroGoldAmount(game, 4);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        planInput(input, t, [
            { prompt: /Pay for which items\?[\s\S]*4 Zm, the contents of your .*sack/, keys: buy ? 'a\n' : '\u001b' },
            ...(buy ? [{ prompt: /bought the contents of your .*sack for 4 gold pieces.*--More--/, keys: ' ' }] : []),
        ]);

        await rhack('p'.charCodeAt(0));

        assert.equal(game.context.move, buy ? 1 : 0);
        assert.equal(heroGoldAmount(game), buy ? 0 : 4);
        assert.equal(shopkeeper.eshk.billct, buy ? 0 : 1);
        assert.equal(dagger.unpaid, !buy);
        assert.equal(dagger.container, sack);
        if (buy) assert.match(messages.join('\n'), /bought the contents of your .*sack for 4 gold pieces/);
    });
}

for (const goldLocation of ['none', 'purse', 'sack'] as const) {
    void test(`paying an empty resident bill takes a turn with gold kept in ${goldLocation}`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        setHeroGoldAmount(game, goldLocation === 'purse' ? 37 : 0);
        if (goldLocation === 'sack') {
            const sack = await addInventoryObject(SACK);
            await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 37 }));
        }

        await rhack('p'.charCodeAt(0));

        assert.match(game._pending_message, /You do not owe Ada anything\./);
        if (goldLocation === 'purse') assert.doesNotMatch(game._pending_message, /no gold/);
        else assert.match(game._pending_message, goldLocation === 'sack'
            ? /Moreover, you seem to have no gold\./ : /Moreover, you have no gold\./);
        assert.equal(game.context.move, 1);
        assert.equal(heroGoldAmount(game), goldLocation === 'purse' ? 37 : 0);
    });
}

void test('buying an unpaid sack and nested goods settles the whole group using credit before cash', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const inner = await knownObject(SACK, { cknown: false });
    const daggers = await knownObject(DAGGER, { quan: 2 });
    await addCreatedObjectToContainer(inner, daggers);
    await addCreatedObjectToContainer(sack, inner);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: sack.o_id, bquan: 1, price: 2, useup: false },
        { bo_id: daggers.o_id, bquan: 2, price: 4, useup: false },
    ] });
    sack.unpaid = daggers.unpaid = true;
    shopkeeper.eshk.credit = 3;
    const goldBefore = shopkeeper.gold ?? 0;
    setHeroGoldAmount(game, 7);
    const input = resetInputState();
    input.feed('a\n');

    await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
        /credit|bought .*sack and its contents|Thank you/, 4);

    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.equal(shopkeeper.gold, goldBefore + 7);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(sack.unpaid, false);
    assert.equal(daggers.unpaid, false);
    assert.equal(daggers.container, inner);
    assert.equal(inner.container, sack);
    assert.equal(sack.cknown, true);
    assert.equal(inner.cknown, false);
    assert.equal(game.context.move, 1);
});

void test('used goods are paid before buying the remaining stack inside a sack', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const daggers = await knownObject(DAGGER, { quan: 2 });
    await addCreatedObjectToContainer(sack, daggers);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: daggers.o_id, bquan: 3, price: 4, useup: false },
    ] });
    daggers.unpaid = true;
    setHeroGoldAmount(game, 12);
    const input = resetInputState();
    input.feed('ab\n');

    await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
        /paid for .*dagger|bought the contents|Thank you/, 4);

    assert.equal(heroGoldAmount(game), 0);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(daggers.unpaid, false);
    assert.equal(daggers.quan, 2);
    assert.equal(daggers.container, sack);
});

for (const scenario of [
    { name: 'paying for contained merchandise without gold or credit takes no turn',
        gold: 0, stashed: 0, debt: 0 },
    { name: 'contained gold cannot fund payment for contained merchandise',
        gold: 0, stashed: 37, debt: 0 },
    { name: 'paying a usage debt spends a turn when no gold remains for contained merchandise',
        gold: 25, stashed: 0, debt: 25 },
]) {
    void test(scenario.name, async () => {
        freshObjectRoom();
        const sack = await addInventoryObject(SACK);
        const dagger = await knownObject(DAGGER);
        await addCreatedObjectToContainer(sack, dagger);
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        ] });
        dagger.unpaid = true;
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.credit = 0;
        shopkeeper.eshk.debit = scenario.debt;
        setHeroGoldAmount(game, scenario.gold);
        if (scenario.stashed) {
            await addCreatedObjectToContainer(sack,
                await knownObject(GOLD_PIECE, { quan: scenario.stashed }));
        }

        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
            /owe Ada|pay that debt|no gold or credit|Thank you/, 3);
        messages.push(game._pending_message);

        assert.equal(game.context.move, scenario.debt ? 1 : 0);
        assert.match(messages.join('\n'),
            new RegExp(`You ${scenario.stashed ? 'seem to ' : ''}have no gold or credit${
                scenario.debt ? ' left' : ''}\\.`));
        if (scenario.debt) assert.match(messages.join('\n'), /Thank you for shopping/);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(dagger.unpaid, true);
        assert.equal(dagger.container, sack);
        assert.equal(heroGoldAmount(game), 0);
    });
}

for (const scenario of [
    { name: 'carried merchandise', contained: false, nested: false, stashed: 0, debt: 0 },
    { name: 'merchandise in a sack', contained: true, nested: false, stashed: 0, debt: 0 },
    { name: 'merchandise in nested sacks', contained: true, nested: true, stashed: 0, debt: 0 },
    { name: 'contained merchandise with stashed gold', contained: true, nested: false, stashed: 37, debt: 0 },
    { name: 'contained merchandise after paying a usage debt', contained: true, nested: false, stashed: 0, debt: 25 },
]) {
    void test(`insufficient funds refuse ${scenario.name} before item selection`, async () => {
        freshObjectRoom();
        const dagger = scenario.contained ? await knownObject(DAGGER)
            : await addInventoryObject(DAGGER);
        const sack = scenario.contained ? await addInventoryObject(SACK, { cknown: true }) : null;
        const container = scenario.nested ? await knownObject(SACK, { cknown: true }) : sack;
        if (sack && container) {
            if (sack !== container) await addCreatedObjectToContainer(sack, container);
            await addCreatedObjectToContainer(container, dagger);
            if (scenario.stashed) await addCreatedObjectToContainer(sack,
                await knownObject(GOLD_PIECE, { quan: scenario.stashed }));
        }
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
        ] });
        dagger.unpaid = true;
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.credit = 0;
        shopkeeper.eshk.debit = scenario.debt;
        setHeroGoldAmount(game, scenario.debt + 1);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
            /owe Ada|pay that debt|enough gold|stashed away|Thank you/, 5);
        messages.push(game._pending_message);

        assert.match(messages.join('\n'), /You don't have enough gold to buy the item on your bill\./);
        if (scenario.stashed) assert.match(messages.join('\n'), /Maybe you have some gold stashed away\?/);
        if (scenario.debt) assert.match(messages.join('\n'), /Thank you for shopping/);
        assert.equal(game.context.move, scenario.debt ? 1 : 0);
        assert.equal(heroGoldAmount(game), 1);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(shopkeeper.eshk.billct, 1);
        assert.equal(dagger.unpaid, true);
        if (container) assert.equal(dagger.container, container);
    });
}

void test('contained merchandise must be affordable as a whole purchase', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const first = await knownObject(DAGGER);
    const second = await knownObject(DAGGER);
    await addCreatedObjectToContainer(sack, first);
    await addCreatedObjectToContainer(sack, second);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: first.o_id, bquan: 1, price: 4, useup: false },
        { bo_id: second.o_id, bquan: 1, price: 4, useup: false },
    ] });
    first.unpaid = second.unpaid = true;
    setHeroGoldAmount(game, 4);

    await rhack('p'.charCodeAt(0));

    assert.match(game._pending_message, /You don't have enough gold to buy any of the items you've picked\./);
    assert.equal(game.context.move, 0);
    assert.equal(heroGoldAmount(game), 4);
    assert.equal(shopkeeper.eshk.billct, 2);
    assert.equal(first.unpaid, true);
    assert.equal(second.unpaid, true);
});

void test('unexamined container contents use the plural insufficient-funds message', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: false });
    const dagger = await knownObject(DAGGER);
    await addCreatedObjectToContainer(sack, dagger);
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
    ] });
    dagger.unpaid = true;
    setHeroGoldAmount(game, 1);

    await rhack('p'.charCodeAt(0));

    assert.match(game._pending_message, /You don't have enough gold to buy any of the items on your bill\./);
    assert.equal(game.context.move, 0);
    assert.equal(heroGoldAmount(game), 1);
    assert.equal(dagger.unpaid, true);
});

for (const scenario of [
    { name: 'gold and credit together cover the price', gold: 1, credit: 3, quantity: 1, billed: 1, expensiveItem: false },
    { name: 'only the cheapest item is affordable', gold: 4, credit: 0, quantity: 1, billed: 1, expensiveItem: true },
    { name: 'the used portion of a partly used stack is affordable', gold: 4, credit: 0, quantity: 2, billed: 3, expensiveItem: false },
]) {
    void test(`payment selection remains available when ${scenario.name}`, async (t) => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER, { quan: scenario.quantity });
        const { shopkeeper } = await createStaffedShop({ bill: [
            { bo_id: dagger.o_id, bquan: scenario.billed, price: 4, useup: false },
        ] });
        dagger.unpaid = true;
        shopkeeper.eshk.credit = scenario.credit;
        if (scenario.expensiveItem) {
            const expensive = await addInventoryObject(SACK);
            expensive.unpaid = true;
            shopkeeper.eshk.bill.push({ bo_id: expensive.o_id, bquan: 1, price: 10, useup: false });
            shopkeeper.eshk.billct++;
        }
        setHeroGoldAmount(game, scenario.gold);
        planInput(resetInputState(), t, [{ prompt: /Pay for which items\?/, keys: '\u001b' }]);

        await rhack('p'.charCodeAt(0));

        assert.equal(game.context.move, 0, 'Cancelling payment does not spend a turn');
        assert.equal(heroGoldAmount(game), scenario.gold);
        assert.equal(shopkeeper.eshk.credit, scenario.credit);
        assert.equal(dagger.unpaid, true);
    });
}

void test('offering payment outside a peaceful shopkeeper\'s shop spends a turn', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK);
    const dagger = await knownObject(DAGGER);
    await addCreatedObjectToContainer(sack, dagger);
    const { shopkeeper } = await createStaffedShop({ left: 11, bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
    ] });
    dagger.unpaid = true;
    shopkeeper.eshk.shknam = 'Ada';
    setHeroGoldAmount(game, 0);

    await rhack('p'.charCodeAt(0));

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /You do not owe Ada anything\./);
    assert.equal(dagger.unpaid, true);
    assert.equal(shopkeeper.eshk.billct, 1);
});

for (const condition of ['sleeping', 'paralyzed'] as const) {
    void test(`paying an empty bill leaves a ${condition} shopkeeper helpless without spending a turn`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.msleeping = condition === 'sleeping' ? 1 : 0;
        shopkeeper.mcanmove = condition === 'paralyzed' ? 0 : 1;
        shopkeeper.mfrozen = condition === 'paralyzed' ? 5 : 0;
        setHeroGoldAmount(game, 37);

        await rhack('p'.charCodeAt(0));

        assert.equal(game.context.move, 0, 'A helpless shopkeeper cannot receive a payment');
        assert.match(game._pending_message, /^Ada (seems to be napping|doesn't respond)\.$/);
        assert.equal(shopkeeper.msleeping, condition === 'sleeping' ? 1 : 0);
        assert.equal(shopkeeper.mcanmove, condition === 'paralyzed' ? 0 : 1);
        assert.equal(shopkeeper.mfrozen, condition === 'paralyzed' ? 5 : 0);
        assert.equal(heroGoldAmount(game), 37);
    });

    void test(`offering to pay a usage debt rouses a ${condition} shopkeeper and settles the debt`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.debit = 25;
        shopkeeper.msleeping = condition === 'sleeping' ? 1 : 0;
        shopkeeper.mcanmove = condition === 'paralyzed' ? 0 : 1;
        shopkeeper.mfrozen = condition === 'paralyzed' ? 5 : 0;
        setHeroGoldAmount(game, 100);

        await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
            /Ada|pay that debt|Thank you/, 3);

        assert.equal(shopkeeper.msleeping, 0, 'Offering payment should wake the shopkeeper');
        assert.equal(shopkeeper.mcanmove, 1, 'Offering payment should end the paralysis');
        assert.equal(shopkeeper.mfrozen, 0);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(heroGoldAmount(game), 75);
        assert.equal(game.context.move, 1);
    });
}

void test('counted walking into a peaceful shopkeeper pays the merchandise usage debt', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.debit = 25;
    setHeroGoldAmount(game, 100);
    pushKeys('3l' + ' '.repeat(20));
    initRng(1n);

    await rhack(0);

    assert.equal(game.u.ux, 10);
    assert.equal(shopkeeper.mx, 11);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(heroGoldAmount(game), 75);
    assert.equal(game.context.move, 1);
});
