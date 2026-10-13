import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core, performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { LOST_NONE, LOST_STOLEN, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { placeObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState, pushKey } from '../js/input.js';
import { removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { LEATHER_ARMOR, OBJECT_NAMES } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { initRng, rn2 } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
async function nearbyThief(species = 'water nymph') {
    const thief = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    thief.mux = game.u.ux;
    thief.muy = game.u.uy;
    return thief;
}
async function finishRemoval(messages) {
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    let reads = 0;
    input.display = { async readKey() {
            assert.ok(++reads <= 24, `Armor removal did not finish: ${game._pending_message}`);
            messages.push(game._pending_message);
            const row = requireScreenRow(0).map(cell => cell.ch).join('');
            return row.includes('--More--') ? 32 : 46;
        } };
    while (game._delayedAction)
        await moveloop_core();
    await flushPendingTopline();
}
for (const species of ['water nymph', 'monkey']) {
    void test(`${species} attempting delayed armor theft preserves the following bite damage`, async () => {
        freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        wearHeroArmor(await addInventoryObject(LEATHER_ARMOR));
        const thief = await nearbyThief(species);
        const lizard = await createMonsterAt('iguana', 10, 11, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        lizard.mux = game.u.ux;
        lizard.muy = game.u.uy;
        installPagerInput(resetInputState(), { expected: /nymph|monkey|iguana/, limit: 12 });
        initRng(1n);
        // Keep selection and refusal deterministic. The monkey still bites
        // after giving up; the nymph's second claw misses.
        await performMonsterHeroAttack(thief, game, {
            random: limit => [3, 6].includes(limit) ? rn2(limit) : limit - 1,
            rollOne: limit => species === 'monkey' || limit === 20 ? 1 : limit,
            rollDice: () => 0,
        });
        await performMonsterHeroAttack(lizard, game, { rollOne: () => 1 });
        assert.equal(game.u.uhp, species === 'monkey' ? 96 : 99, 'The following bite damage includes the native thief hit tails');
    });
}
void test('a second armor theft waits out the longer removal already in progress', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    const first = await nearbyThief();
    const second = await createMonsterAt('wood nymph', 10, 11, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    second.mux = game.u.ux;
    second.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });
    await performMonsterHeroAttack(first, game, { random: () => 0, rollOne: () => 1 });
    await performMonsterHeroAttack(second, game, { random: limit => limit - 1, rollOne: () => 1 });
    first.movement = second.movement = -100;
    const started = game.moves;
    await finishRemoval([]);
    assert.equal(game.moves - started, 3, 'The two-turn boots cannot shorten the three-turn suit delay');
    assert.ok(second.minvent.includes(boots));
    assert.ok(game.inventory.includes(suit));
});
void test('a second armor theft does not restart an elapsed turn of removal', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    const first = await nearbyThief();
    const second = await createMonsterAt('wood nymph', 10, 11, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    second.mux = game.u.ux;
    second.muy = game.u.uy;
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });
    await performMonsterHeroAttack(first, game, { random: () => 0, rollOne: () => 1 });
    first.movement = second.movement = -100;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const started = game.moves;
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves - started, 1, 'One turn of the suit removal has elapsed');
    await performMonsterHeroAttack(second, game, { random: limit => limit - 1, rollOne: () => 1 });
    await finishRemoval([]);
    assert.equal(game.moves - started, 3, 'The boots take the two remaining turns, not three new turns');
    assert.ok(second.minvent.includes(boots));
    assert.ok(game.inventory.includes(suit));
});
void test('a nymph steals interrupted donning armor immediately after it becomes unworn', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    pushKey(suit.invlet);
    await rhack('W'.charCodeAt(0));
    const thief = await nearbyThief();
    const input = resetInputState();
    installPagerInput(input, { expected: /wear|putting on|nymph|She/, limit: 12 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();
    assert.ok(thief.minvent.includes(suit), 'Cancelled donning leaves no armor-removal delay');
    assert.equal(game._delayedAction, null);
    assert.doesNotMatch(messages.join('\n'), /charms|seduces|takes off/);
});
void test('a monkey can give up stealing boots even after removal has started', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(boots);
    pushKey(boots.invlet);
    await rhack('T'.charCodeAt(0));
    const thief = await nearbyThief('monkey');
    const input = resetInputState();
    installPagerInput(input, { expected: /boots|monkey/, limit: 12 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    await flushPendingTopline();
    assert.ok(game.uarmf === boots, 'Interrupted removal leaves the refused boots worn');
    assert.ok(game.inventory.includes(boots));
    assert.equal(thief.minvent.includes(boots), false);
    assert.equal(game._delayedAction, null, 'The theft attempt still cancels armor removal');
    assert.match(messages.join('\n'), /The monkey tries to take your shoes but gives up\./);
});
for (const previousLoss of [LOST_NONE, LOST_STOLEN]) {
    void test(`delayed theft ${previousLoss === LOST_STOLEN ? 'keeps the stolen suit pickup override' : 'respects the ordinary suit pickup filter'}`, async () => {
        const level = freshObjectRoom({ flags: {
                female: true, pickup: true, pickup_types: '$', pickup_stolen: true,
            }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        level.flags.noteleport = true;
        requirePlayingGame(game);
        const suit = await addInventoryObject(LEATHER_ARMOR);
        suit.how_lost = previousLoss;
        wearHeroArmor(suit);
        const thief = await nearbyThief();
        installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });
        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        thief.movement = -100;
        await finishRemoval([]);
        await removeObjectFromMonsterInventory(thief, suit);
        await placeObject(suit, game.u.ux, game.u.uy);
        await autopickupAtHero();
        assert.equal(game.inventory.includes(suit), previousLoss === LOST_STOLEN, 'Only an already stolen suit overrides the gold-only pickup filter');
    });
}
void test('a visible delayed armor thief reports that teleportation is prevented', async () => {
    const level = freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    level.flags.noteleport = true;
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    thief.movement = -100;
    const messages = [];
    await finishRemoval(messages);
    assert.match(messages.join('\n'), /steals[\s\S]*A mysterious force prevents the water nymph from teleporting!/);
    assert.equal(thief.mx, 11);
    assert.equal(thief.my, 10);
});
//# sourceMappingURL=pool_armor_theft_review.test.js.map