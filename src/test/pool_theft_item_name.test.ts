import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, W_WEP } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, POT_HEALING } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addShopObjectToBill } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';

void test('a monkey fleeing with unpaid goods names the shopkeeper as their owner', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    shopkeeper.eshk.shknam = '+Ada';
    const dagger = await addInventoryObject(DAGGER);
    await addShopObjectToBill(dagger, game, { silent: true });
    assert.equal(dagger.unpaid, true, 'The dagger starts on the shop bill');
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(monkey.minvent.includes(dagger));
    assert.equal(dagger.unpaid, false, 'The theft clears the unpaid flag');
    assert.equal(shopkeeper.eshk.bill.length, 0, 'The theft removes the dagger from the bill');
    assert.match(messages.join('\n'), /The monkey tries to run away with Ada's dagger\./);
});

void test('a monkey names a newly observed potion appearance when fleeing with it', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = 'magenta';
    const potion = await addInventoryObject(POT_HEALING, {
        dknown: false, typeKnown: false, observed: false,
    });
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(monkey.minvent.includes(potion));
    assert.equal(potion.dknown, true);
    const prose = messages.join('\n');
    assert.match(prose, /The monkey stole an uncursed magenta potion\./);
    assert.match(prose, /The monkey tries to run away with your magenta potion\./);
});

void test('theft while blind does not reveal an unseen potion appearance', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = 'magenta';
    const potion = await addInventoryObject(POT_HEALING, {
        dknown: false, typeKnown: false, observed: false,
    });
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /Something|monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(monkey.minvent.includes(potion));
    assert.equal(potion.dknown, false);
    assert.match(messages.join('\n'), /stole an uncursed potion\./);
    assert.doesNotMatch(messages.join('\n'), /magenta/);
});

void test('a hallucinated disarm names the thief afresh while the theft keeps its first name', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, hallucinationTurns: 50 } });
    requirePlayingGame(game);
    const dagger = await addInventoryObject(DAGGER);
    game.uwep = dagger;
    dagger.owornmask = W_WEP;
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /\S/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    // steal() caches Some_Monnam() before worn_item_removal() calls it again.
    const prose = messages.join('\n');
    const disarm = /(?:^|\s)(The [^.!]+?) disarms your /.exec(prose);
    const theft = /(?:^|\s)(The [^.!]+?) stole /.exec(prose);
    assert.ok(disarm && theft, prose);
    assert.ok(monkey.minvent.includes(dagger));
    assert.notEqual(disarm[1], theft[1], prose);
});
