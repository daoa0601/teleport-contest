import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, WAN_UNDEAD_TURNING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { answerPrompts } from './support/input-boundaries.js';

for (const quantity of [1, 2]) {
    void test(`undead turning describes ${quantity === 1 ? "the Oracle's corpse" : "one of the Oracle's corpses"} with one article`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const body = await floorObject(CORPSE, game.u.ux, game.u.uy, {
            corpsenm: MONSTER_NAME.indexOf('Oracle'), quan: quantity,
        });
        const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => {
            if (game._pending_message) messages.push(game._pending_message);
        };
        installPagerInput(input, { expected: /glows iridescently/, limit: 2 });
        input.feed(`${wand.invlet}>`);

        await rhack('z'.charCodeAt(0));

        assert.match([...messages, game._pending_message].join('\n'), quantity === 1
            ? /^The Oracle's corpse glows iridescently\./m
            : /^One of the Oracle's corpses glows iridescently\./m);
        assert.match(game._pending_message, /is resurrected!/);
        assert.equal(body.where, quantity === 1 ? 'gone' : 'floor');
        if (quantity > 1) assert.equal(body.quan, quantity - 1);
        assert.equal(wand.spe, 1);
    });
}

void test('reviving shop stock with a wand charges only the corpse brought to life', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 13 });
    const bodies = await floorObject(CORPSE, 11, 10, {
        corpsenm: MONSTER_NAME.indexOf('troll'), quan: 3, no_charge: false,
    });
    const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
    const input = resetInputState();
    installPagerInput(input, { expected: /corpse|resurrected|owe/, limit: 8 });
    input.feed(`${wand.invlet}l`);

    await rhack('z'.charCodeAt(0));

    assert.equal(bodies.quan, 2);
    assert.ok(shopkeeper.eshk.debit > 0, 'A resuscitated shop corpse must be paid for.');
    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
});

void test('self-directed undead turning describes a glowing carried corpse as it comes alive', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const body = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('troll') });
    const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
    const input = resetInputState();
    input.feed(`${wand.invlet}.`);

    await answerPrompts(rhack('z'.charCodeAt(0)), input, [
        { prompt: /Your troll corpse glows iridescently\.  It suddenly comes alive![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(body.where, 'gone');
    assert.match(game._pending_message, /You shudder in dread\./);
    assert.equal(wand.spe, 1);
});

void test('undead turning reports an eel corpse twitching when there is no water to revive in', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const body = await floorObject(CORPSE, 10, 10, { corpsenm: MONSTER_NAME.indexOf('giant eel') });
    const wand = await addInventoryObject(WAN_UNDEAD_TURNING, { spe: 2 });
    const input = resetInputState();
    input.feed(`${wand.invlet}>`);

    await rhack('z'.charCodeAt(0));

    assert.equal(body.where, 'floor');
    assert.equal(game._pending_message, 'The giant eel corpse twitches feebly.');
    assert.equal(wand.spe, 1);
});
