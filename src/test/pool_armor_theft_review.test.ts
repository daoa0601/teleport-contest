import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core, performMonsterHeroAttack } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { LOST_NONE, LOST_STOLEN, MENU_PARTIAL, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { placeObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState, pushKey, pushKeys } from '../js/input.js';
import { removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_LIFE_SAVING, DAGGER, LEATHER_ARMOR, OBJECT_NAMES } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
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

async function finishRemoval(messages: string[]) {
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
    while (game._delayedAction) await moveloop_core();
    await flushPendingTopline();
}

for (const species of ['water nymph', 'monkey']) {
    void test(`${species} attempting delayed armor theft leaves later bite attacks active`, async () => {
        freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        wearHeroArmor(await addInventoryObject(LEATHER_ARMOR));
        const thief = await nearbyThief(species);
        const lizard = await createMonsterAt('iguana', 10, 11, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        lizard.mux = game.u.ux;
        lizard.muy = game.u.uy;
        installPagerInput(resetInputState(), { expected: /nymph|monkey|iguana/, limit: 12 });
        await performMonsterHeroAttack(thief, game, {
            random: limit => limit - 1,
            rollOne: () => 1,
            rollDice: count => count,
        });
        await performMonsterHeroAttack(lizard, game, { rollOne: () => 1, rollDice: count => count });

        assert.equal(game.u.uhp, species === 'monkey' ? 98 : 99,
            'The monkey can still bite after refusal, and the iguana bites after either thief');
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

void test('later sleep keeps delayed armor theft pending until the hero wakes', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    thief.movement = -100;
    const started = game.moves;
    const messages: string[] = [];

    putHeroToSleep(8);
    await finishRemoval(messages);

    assert.equal(game.moves - started, 8, 'The theft waits for all eight turns of sleep');
    assert.ok(thief.minvent.includes(suit));
    assert.match(messages.join('\n'), /You wake up\.[\s\S]*The water nymph steals/);
});

void test('life saving shortens delayed armor theft to the single recovery turn', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|amulet|medallion|But wait|die|feel much better/, limit: 16 });
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    thief.movement = -100;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const started = game.moves;
    const messages: string[] = [];

    assert.equal(await loseHeroHp(2, 'acid'), false);
    await finishRemoval(messages);

    assert.equal(amulet.where, 'gone');
    assert.equal(game.moves - started, 1, 'Life saving replaces the suit delay with one recovery turn');
    assert.ok(thief.minvent.includes(suit));
    assert.match(messages.join('\n'), /You survived that attempt on your life\.[\s\S]*The water nymph steals/);
});

void test('armor theft after life saving uses the new recovery delay', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    const thief = await nearbyThief();
    installPagerInput(resetInputState(), { expected: /nymph|amulet|medallion|But wait|die|feel much better/, limit: 16 });
    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    assert.equal(await loseHeroHp(2, 'acid'), false);
    const started = game.moves;

    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    thief.movement = -100;
    await finishRemoval([]);

    assert.equal(game.moves - started, 2, 'Boot removal takes two turns after the one-turn life-saving recovery');
    assert.ok(thief.minvent.includes(boots));
    assert.ok(game.inventory.includes(suit), 'The later theft replaces the pending suit');
});

void test('a nymph stealing another item stays nearby until delayed suit theft finishes', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const dagger = await addInventoryObject(DAGGER);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    installPagerInput(resetInputState(), { expected: /nymph|She/, limit: 12 });

    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });

    assert.ok(thief.minvent.includes(dagger), 'The extra item is stolen immediately');
    assert.equal(thief.mx, 11, 'The thief stays next to the suit she is waiting for');
    assert.equal(thief.my, 10);
    assert.equal(thief.mflee ?? 0, 0);
    thief.movement = -100;
    await finishRemoval([]);
    assert.ok(thief.minvent.includes(suit), 'The pending suit is still stolen after removal');
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
    const messages: string[] = [];
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
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(thief, game, { random: limit => limit - 1, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(game.uarmf === boots, 'Interrupted removal leaves the refused boots worn');
    assert.ok(game.inventory.includes(boots));
    assert.equal(thief.minvent.includes(boots), false);
    assert.equal(game._delayedAction, null, 'The theft attempt still cancels armor removal');
    assert.match(messages.join('\n'), /The monkey tries to take your shoes but gives up\./);
});

for (const female of [true, false]) {
    void test(`a nymph continues ${female ? 'removing' : 'taking off'} the suit already being removed with A`, async () => {
        freshObjectRoom({ flags: { female, menu_style: MENU_PARTIAL }, hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        pushKeys(`${suit.invlet}\n`);
        await rhack('A'.charCodeAt(0));
        await continueCountedCommand();
        assert.ok(game.uarm === suit, 'Bulk removal leaves the suit worn during its delay');
        const thief = await nearbyThief();
        const input = resetInputState();
        installPagerInput(input, { expected: /nymph|suit|disrobing/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
        await flushPendingTopline();

        assert.match(messages.join('\n'), female
            ? /You gladly continue removing your suit\./
            : /you continue taking off your suit\./);
        assert.equal(game.uarm, null);
        assert.ok(game.inventory.includes(suit), 'The charmed suit waits for its theft delay');
    });
}

for (const restricted of [false, true]) {
    void test(`a nymph refusing a paralyzed hero's armor ${restricted ? 'reports blocked teleportation' : 'teleports before fleeing'}`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        level.flags.noteleport = restricted;
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        const thief = await nearbyThief();
        game._helplessTurns = 4;
        game._helplessReason = 'paralyzed';
        const input = resetInputState();
        installPagerInput(input, { expected: /nymph/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(thief, game, {
            random: limit => limit === 2 ? 0 : limit - 1, rollOne: () => 1,
        });
        await flushPendingTopline();

        assert.ok(game.uarm === suit);
        assert.equal(thief.minvent.includes(suit), false);
        assert.equal(thief.mflee, 1);
        if (restricted) {
            assert.match(messages.join('\n'), /A mysterious force prevents the water nymph from teleporting!/);
            assert.equal(thief.mx, 11);
            assert.equal(thief.my, 10);
        } else {
            assert.ok(thief.mx !== 11 || thief.my !== 10, 'Refusal still attempts teleportation');
        }
    });
}

for (const female of [true, false]) {
    void test(`a cancelled nymph reports failed ${female ? 'charm' : 'seduction'} and ends her attack when retreat is blocked`, async () => {
        const level = freshObjectRoom({ flags: { female }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        level.flags.noteleport = true;
        requirePlayingGame(game);
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        const thief = await nearbyThief();
        thief.mcan = true;
        const input = resetInputState();
        installPagerInput(input, { expected: /nymph/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(thief, game, { random: () => 1, rollOne: () => 1 });
        await flushPendingTopline();

        const feedback = messages.join('\n');
        assert.match(feedback, female
            ? /The plain water nymph tries to charm you, but you seem unaffected\./
            : /The plain water nymph tries to seduce you, but you seem uninterested\./);
        assert.equal(feedback.match(/tries to (?:charm|seduce)/g)?.length, 1,
            'Attempting retreat ends the attack before the second claw, even when teleportation is blocked');
        assert.match(feedback, /A mysterious force prevents the water nymph from teleporting!/);
        assert.ok(game.uarm === suit);
        assert.equal(thief.mflee ?? 0, 0, 'Cancelled seduction does not set fleeing');
    });
}

void test('a cancelled nymph can continue with her second claw when she does not retreat', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    thief.mcan = true;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.equal(messages.join('\n').match(/tries to charm you/g)?.length, 2);
    assert.ok(game.uarm === suit);
    assert.equal(thief.mx, 11);
    assert.equal(thief.my, 10);
    assert.equal(thief.mflee ?? 0, 0);
});

for (const blind of [false, true]) {
    void test(`a cancelled nymph teleports away${blind ? ' without seduction feedback to a blind hero' : ' after failed seduction'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10, blindTurns: blind ? 10 : 0 } });
        requirePlayingGame(game);
        const suit = await addInventoryObject(LEATHER_ARMOR);
        wearHeroArmor(suit);
        const thief = await nearbyThief();
        thief.mcan = true;
        const input = resetInputState();
        installPagerInput(input, { expected: /nymph/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(thief, game, { random: () => 1, rollOne: () => 1 });
        await flushPendingTopline();

        assert.ok(thief.mx !== 11 || thief.my !== 10, 'The cancelled nymph relocates instead of stealing');
        assert.ok(game.uarm === suit);
        if (blind) assert.doesNotMatch(messages.join('\n'), /tries to (?:charm|seduce)/);
        else assert.equal(messages.join('\n').match(/tries to seduce/g)?.length, 1);
        assert.equal(thief.mflee ?? 0, 0);
    });
}

for (const previousLoss of [LOST_NONE, LOST_STOLEN] as const) {
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

        assert.equal(game.inventory.includes(suit), previousLoss === LOST_STOLEN,
            'Only an already stolen suit overrides the gold-only pickup filter');
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
    const messages: string[] = [];
    await finishRemoval(messages);

    assert.match(messages.join('\n'), /steals[\s\S]*A mysterious force prevents the water nymph from teleporting!/);
    assert.equal(thief.mx, 11);
    assert.equal(thief.my, 10);
});

void test('the hero can move again before the nymph announces delayed armor theft', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    installPagerInput(resetInputState(), { expected: /nymph/, limit: 12 });

    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });
    thief.movement = -100;
    const messages: string[] = [];
    await finishRemoval(messages);

    assert.match(messages.join('\n'), /You can move again\.[\s\S]*The water nymph steals/);
    assert.ok(thief.minvent.includes(suit));
});

void test('seduction temporarily uncurses armor before its message pager and restores the curse after removal', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR, { cursed: true });
    wearHeroArmor(suit);
    const thief = await nearbyThief();
    const priorMessage = 'You examine the worn suit carefully before the water nymph approaches you.';
    await plineWithContinuation(priorMessage);
    const input = resetInputState();
    installPagerInput(input, { expected: /suit|nymph/, limit: 12 });
    let inspectedPager = false;
    input.beforeRead = () => {
        if (game._pending_message !== priorMessage) return;
        inspectedPager = true;
        assert.equal(suit.cursed, false, 'The seduction message publishes with the armor temporarily uncursed');
        assert.ok(game.uarm === suit, 'Armor remains worn until the seduction message is acknowledged');
    };

    await performMonsterHeroAttack(thief, game, { random: () => 0, rollOne: () => 1 });

    assert.ok(inspectedPager, 'Seduction must acknowledge the previous message before removing the suit');
    assert.equal(suit.cursed, true, 'Removal restores the original curse');
    assert.equal(game.uarm, null);
    assert.match(game._pending_message, /You gladly let her take your suit\./);
});
