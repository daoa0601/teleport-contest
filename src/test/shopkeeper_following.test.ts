import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import type { Monster } from '../js/monster_types.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { cls, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createStaffedShop } from './support/shop.js';

async function keeperTurnMessages(keeper: Monster) {
    requirePlayingGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    installPagerInput(input, { expected: /Mira|Nora|Hello|Irasshaimase|Konnichi/, limit: 4 });
    await takeMonsterTurn(keeper, game);
    messages.push(game._pending_message || '');
    return messages.join('\n');
}

function followCustomer(keeper: Monster, name = 'Mira') {
    assert.ok(keeper.eshk);
    game.plname = 'Robin';
    keeper.eshk.shknam = `+${name}`;
    keeper.eshk.following = true;
    keeper.eshk.customer = game.plname;
}

void test('a keeper stops following a different customer after greeting the hero', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Robin';
    const { shopkeeper } = await createStaffedShop();
    followCustomer(shopkeeper);
    shopkeeper.eshk.customer = 'Alex';

    const messages = await keeperTurnMessages(shopkeeper);

    assert.equal(shopkeeper.eshk.following, false);
    assert.match(messages, /"Hello, Robin!  I was looking for Alex\."/);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [11, 10]);
});

void test('a following keeper reminds a Samurai customer without stepping away', async () => {
    freshObjectRoom({ role: 'samurai' });
    requirePlayingGame(game);
    game.plname = 'Robin';
    const { shopkeeper } = await createStaffedShop();
    followCustomer(shopkeeper);

    const messages = await keeperTurnMessages(shopkeeper);

    assert.match(messages, /"Irasshaimase, Robin!  Didn't you forget to pay\?"/);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [11, 10]);
});

for (const [species, deaf, pronoun, hand] of [
    ['shopkeeper', true, 'his', 'hand'],
    ['red dragon', false, 'its', 'foreclaw'],
] as const) {
    void test(`a following ${species} gestures when ${deaf ? 'the customer is deaf' : 'it cannot speak'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop();
        if (species !== 'shopkeeper')
            await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf(species));
        shopkeeper.female = false;
        game.u.deafTurns = deaf ? 20 : 0;
        followCustomer(shopkeeper);

        const messages = await keeperTurnMessages(shopkeeper);

        assert.match(messages, new RegExp(`Mira holds out ${pronoun} upturned ${hand}\\.`));
        assert.deepEqual([shopkeeper.mx, shopkeeper.my], [11, 10]);
    });
}

void test('following keepers share the five-turn reminder interval', async () => {
    freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const first = (await createStaffedShop({ left: 14, right: 16, keeperX: 14 })).shopkeeper;
    const second = (await createStaffedShop({ left: 19, right: 21, keeperX: 19 })).shopkeeper;
    first.mx = 11;
    first.my = 10;
    second.mx = 10;
    second.my = 11;
    followCustomer(first);
    followCustomer(second, 'Nora');

    const messages = await keeperTurnMessages(first);
    assert.match(messages, /Didn't you forget to pay/);
    await cls();
    assert.doesNotMatch(await keeperTurnMessages(second), /Didn't you forget to pay/);

    game.moves += 4;
    assert.doesNotMatch(await keeperTurnMessages(second), /Didn't you forget to pay/);
    game.moves++;
    assert.match(await keeperTurnMessages(second), /Didn't you forget to pay/);
});

void test('restoring a game resets the unsaved shop reminder interval', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    followCustomer(shopkeeper);
    const storage = memoryStorage();

    const messages = await keeperTurnMessages(shopkeeper);
    assert.match(messages, /Didn't you forget to pay/);
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    await cls();

    const restored = game.level.monsters.find(monster => monster.isshk);
    assert.ok(restored);
    const restoredMessages = await keeperTurnMessages(restored);

    assert.match(restoredMessages, /Didn't you forget to pay/);
});

void test('a silent keeper drops a mismatched customer without a reminder gesture', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    followCustomer(shopkeeper);
    shopkeeper.eshk.customer = 'Alex';
    game.u.deafTurns = 20;

    const messages = await keeperTurnMessages(shopkeeper);

    assert.equal(shopkeeper.eshk.following, false);
    assert.equal(messages.trim(), '');
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [11, 10]);
});

void test('a polymorphed speaking keeper uses the general Samurai greeting', async () => {
    freshObjectRoom({ role: 'samurai' });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf('red naga'));
    followCustomer(shopkeeper);

    const messages = await keeperTurnMessages(shopkeeper);

    assert.match(messages, /"Konnichi wa, Robin!  Didn't you forget to pay\?"/);
});

for (const species of ['shopkeeper', 'grid bug']) {
    void test(`a diagonal following ${species} can close the gap to its customer`, async () => {
        freshObjectRoom({ moves: 1 });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ keeperY: 11 });
        if (species !== 'shopkeeper')
            await changeMonsterForm(shopkeeper, MONSTER_NAME.indexOf(species));
        followCustomer(shopkeeper);

        const messages = await keeperTurnMessages(shopkeeper);

        assert.equal(Math.abs(shopkeeper.mx - game.u.ux)
            + Math.abs(shopkeeper.my - game.u.uy), 1);
        assert.doesNotMatch(messages, /forget to pay|holds out/);
    });
}

void test('a keeper finishes the mistaken-customer message before ending pursuit', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    followCustomer(shopkeeper);
    shopkeeper.eshk.customer = 'Alex';
    await plineWithContinuation('A distant crash draws your attention to the entrance of the shop.');
    const input = resetInputState();

    const turn = takeMonsterTurn(shopkeeper, game);
    try {
        await input.waitUntilBlocked();
        assert.equal(shopkeeper.eshk.following, true);
    } finally {
        await answerPrompts(turn, input, [{
            prompt: /A distant crash[\s\S]*--More--/, keys: ' ',
        }]);
    }

    assert.equal(shopkeeper.eshk.following, false);
    assert.match(game._pending_message, /I was looking for Alex/);
});
