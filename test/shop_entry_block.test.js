import test from 'node:test';
import assert from 'node:assert/strict';
import { D_ISOPEN, DOOR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { DWARVISH_MATTOCK, PICK_AXE } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { checkSpecialRoom, objectTypeKnown } from '../js/shk.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
async function shopEntrance() {
    freshObjectRoom({ left: 3, right: 18, hero: { ux: 7, uy: 10 } });
    requirePlayingGame(game);
    const shop = await createStaffedShop({ left: 9, right: 17, keeperX: 9, doorX: 8 });
    const door = game.level.requireAt(8, 10);
    door.typ = DOOR;
    door.flags = D_ISOPEN;
    door.roomno = shop.roomno;
    door.edge = true;
    shop.shopkeeper.eshk.shknam = 'Izchak';
    shop.shopkeeper.eshk.customer = game.plname;
    shop.shopkeeper.eshk.visitct = 1;
    return shop;
}
async function enterAt(x = 8) {
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = x;
    pushKeys('                    ');
    await checkSpecialRoom();
}
const toolCases = [
    { tools: [PICK_AXE], text: 'pick-axe' },
    { tools: [PICK_AXE, PICK_AXE], text: 'pick-axes' },
    { tools: [DWARVISH_MATTOCK], text: 'mattock' },
    { tools: [DWARVISH_MATTOCK, DWARVISH_MATTOCK], text: 'mattocks' },
    { tools: [PICK_AXE, DWARVISH_MATTOCK], text: 'digging tools' },
];
for (const { tools, text } of toolCases) {
    for (const upset of [false, true]) {
        void test(`a ${upset ? 'surcharging' : 'calm'} keeper asks an arriving hero to leave ${text} outside`, async () => {
            const { shopkeeper } = await shopEntrance();
            shopkeeper.eshk.surcharge = upset;
            for (const type of tools)
                await addInventoryObject(type, { initialize: false, nomerge: true });
            await enterAt();
            assert.equal(game._lastPlineMessage, upset
                ? `"Leave the ${text} outside."`
                : `"Will you please leave your ${text} outside?"`);
        });
    }
}
for (const upset of [false, true]) {
    for (const { tools, text } of toolCases) {
        void test(`a deaf hero carrying ${text} sees the ${upset ? 'refusal' : 'hesitation'}`, async () => {
            const { shopkeeper } = await shopEntrance();
            shopkeeper.eshk.surcharge = upset;
            game.u.deafTurns = 20;
            for (const type of tools)
                await addInventoryObject(type, { initialize: false, nomerge: true });
            await enterAt();
            assert.equal(game._lastPlineMessage, `Izchak ${upset ? 'refuses' : 'is hesitant'} to let you in with your ${text}.`);
        });
    }
    for (const deaf of [false, true]) {
        void test(`a ${upset ? 'surcharging' : 'calm'} keeper warns an arriving ${deaf ? 'deaf ' : ''}rider`, async () => {
            const { shopkeeper } = await shopEntrance();
            shopkeeper.eshk.surcharge = upset;
            const steed = await createSaddledSteed('pony', { x: 6, y: 10 });
            game.u.usteed = steed;
            if (deaf)
                game.u.deafTurns = 20;
            await enterAt();
            assert.equal(game._lastPlineMessage, deaf
                ? `Izchak ${upset ? 'refuses' : "doesn't want"} to let you in while you're riding your pony.`
                : upset ? '"Leave your pony outside."' : '"Will you please leave your pony outside?"');
        });
    }
}
for (const blind of [false, true]) {
    void test(`the mattock warning ${blind ? 'does not teach a blind hero' : 'teaches a sighted hero'} its type`, async () => {
        await shopEntrance();
        await addInventoryObject(DWARVISH_MATTOCK, { initialize: false, typeKnown: false });
        if (blind)
            setHeroBlindnessTurns(20);
        await enterAt();
        assert.equal(objectTypeKnown({ otyp: DWARVISH_MATTOCK }), !blind);
    });
}
void test('the greeting waits for acknowledgment before warning and moving the keeper', async () => {
    const { shopkeeper } = await shopEntrance();
    shopkeeper.mx = 13;
    shopkeeper.movement = 0;
    await addInventoryObject(PICK_AXE, { initialize: false });
    game.u.ux0 = 7;
    game.u.ux = 8;
    const input = resetInputState();
    const entry = checkSpecialRoom();
    const boundary = await Promise.race([
        entry.then(() => 'completed'),
        input.waitUntilBlocked().then(() => 'input'),
    ]);
    assert.equal(boundary, 'input', 'The greeting must pause before the warning');
    assert.equal(shopkeeper.mx, 13, 'The keeper must wait until the greeting is dismissed');
    await answerPrompts(entry, input, [
        { prompt: /Welcome again to Izchak's general store!"--More--/, keys: ' ' },
    ]);
    assert.equal(shopkeeper.mx, 12, 'Entry gives the keeper one step toward the blocking square');
    assert.equal(shopkeeper.my, 10);
    assert.equal(shopkeeper.movement, 0, 'The extra action does not spend scheduled movement');
    assert.equal(game.moves, 40);
});
for (const fast of [false, true]) {
    for (const tool of [PICK_AXE, DWARVISH_MATTOCK]) {
        void test(`a floor ${tool === PICK_AXE ? 'pick' : 'mattock'} ${fast ? 'gives' : 'does not give'} the keeper an extra move when the arriving hero ${fast ? 'is fast' : 'has normal speed'}`, async () => {
            const { shopkeeper } = await shopEntrance();
            shopkeeper.mx = 13;
            game.u.fast = fast;
            await floorObject(tool, 8, 10);
            await enterAt();
            assert.equal(shopkeeper.mx, fast ? 12 : 13);
            assert.match(game._lastPlineMessage ?? '', /Welcome again/);
        });
    }
}
void test('teleporting directly inside with a pick does not warn or move the keeper', async () => {
    const { shopkeeper } = await shopEntrance();
    shopkeeper.mx = 13;
    await addInventoryObject(PICK_AXE, { initialize: false });
    await enterAt(10);
    assert.match(game._lastPlineMessage ?? '', /Welcome again/);
    assert.equal(shopkeeper.mx, 13);
});
void test('a mute keeper gives neither greeting nor entry warning nor extra action', async () => {
    const { shopkeeper } = await shopEntrance();
    shopkeeper.mx = 13;
    shopkeeper.mcanmove = 0;
    shopkeeper.mfrozen = 20;
    await addInventoryObject(PICK_AXE, { initialize: false });
    await enterAt();
    assert.equal(game._lastPlineMessage ?? '', '');
    assert.equal(shopkeeper.mx, 13);
});
//# sourceMappingURL=shop_entry_block.test.js.map