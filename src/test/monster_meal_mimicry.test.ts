import test from 'node:test';
import assert from 'node:assert/strict';

import { removeHeroAccessory, wearHeroAccessory } from '../js/accessory.js';
import { M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, ROOM } from '../js/const.js';
import { canSpotMonster, glyphAt, newsym, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishMonsterEating } from '../js/monster_eating.js';
import { beginMonsterMealMimicry } from '../js/monster_meal_mimicry.js';
import { putMonsterToSleep } from '../js/monster_sleep.js';
import { LEASH, RIN_PROTECTION_FROM_SHAPE_CHANGERS, TRIPE_RATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a dog borrowing a kitten appearance is revealed when its meal finishes', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    dog.meating = 4;
    newsym(dog.mx, dog.my);
    initRng(1n);
    const input = resetInputState();

    await answerPrompts(beginMonsterMealMimicry(dog), input, [
        { prompt: /You see a kitten appear where your little dog was![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(dog.mnum, MONSTER_NAME.indexOf('little dog'));
    assert.equal(dog.m_ap_type, M_AP_MONSTER);
    assert.equal(dog.mappearance, MONSTER_NAME.indexOf('kitten'));
    finishMonsterEating(dog);
    assert.equal(dog.m_ap_type, M_AP_NOTHING);
    assert.equal(dog.meating, 0);
    const glyph = glyphAt(dog.mx, dog.my);
    assert.ok(glyph?.kind === 'monster');
    assert.equal(glyph.mnum, dog.mnum);
});

void test('a dog appearing as a sink releases its attached leash', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    const leash = await addInventoryObject(LEASH, { leashmon: dog.m_id });
    dog.mleashed = 1;
    dog.meating = 4;
    newsym(dog.mx, dog.my);
    initRng(2n);
    const input = resetInputState();

    await answerPrompts(beginMonsterMealMimicry(dog), input, [
        { prompt: /Your leash goes slack[\s\S]*--More--/, keys: ' ' },
        { prompt: /You see a sink appear where your little dog was![\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(dog.m_ap_type, M_AP_FURNITURE);
    assert.equal(!!dog.mleashed, false);
    assert.equal(leash.leashmon, 0);
});

void test('Escape at an earlier warning prevents another mimic meal message pause', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    dog.meating = 4;
    newsym(dog.mx, dog.my);
    await plineWithContinuation('Your little dog is confused from hunger.');
    initRng(1n);
    const input = resetInputState();

    await answerPrompts(beginMonsterMealMimicry(dog), input, [
        { prompt: /Your little dog is confused from hunger\.[\s\S]*--More--/, keys: 27 },
    ]);

    assert.equal(dog.m_ap_type, M_AP_MONSTER);
    assert.equal(dog.mappearance, MONSTER_NAME.indexOf('kitten'));
});

void test('sleep interrupts a mimic meal and removes the borrowed appearance', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    dog.meating = 4;
    initRng(1n);
    const input = resetInputState();
    await answerPrompts(beginMonsterMealMimicry(dog), input, [
        { prompt: /kitten appear[\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(putMonsterToSleep(dog, 6), true);

    assert.equal(dog.m_ap_type, M_AP_NOTHING);
    assert.equal(dog.meating, 0);
    assert.equal(dog.mcanmove, 0);
    assert.equal(dog.mfrozen, 6);
});

void test('sleep with no duration lasts until the monster is awakened', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);

    assert.equal(putMonsterToSleep(dog, 0), true);

    assert.equal(!!dog.msleeping, true);
    assert.equal(!!dog.mcanmove, true);
    assert.equal(dog.mfrozen ?? 0, 0);
});

void test('an unseen mimic meal changes appearance without asking for input', async () => {
    const level = freshObjectRoom();
    level.requireAt(30, 15).typ = ROOM;
    const eater = await createMonsterAt('little dog', 30, 15);
    initializePet(eater);
    eater.meating = 4;
    assert.equal(canSpotMonster(eater), false);
    initRng(4n);
    const input = resetInputState();

    await answerPrompts(beginMonsterMealMimicry(eater), input, []);

    assert.equal(eater.m_ap_type, M_AP_OBJECT);
    assert.equal(eater.mappearance, TRIPE_RATION);
});

void test('protection from shape changers suppresses a meal disguise and restores one already present', async () => {
    freshObjectRoom();
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    dog.meating = 4;
    initRng(1n);
    const input = resetInputState();
    await answerPrompts(beginMonsterMealMimicry(dog), input, [
        { prompt: /kitten appear[\s\S]*--More--/, keys: ' ' },
    ]);
    const ring = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(ring, 'uleft');
    assert.equal(dog.m_ap_type, M_AP_NOTHING);
    dog.meating = 4;

    await answerPrompts(beginMonsterMealMimicry(dog), input, []);

    assert.equal(dog.m_ap_type, M_AP_NOTHING);
});

void test('mimicking while mounted dismounts the hero without a riding accident', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pony = await createSaddledSteed('pony', { x: game.u.ux, y: game.u.uy });
    game.u.usteed = pony;
    pony.meating = 4;
    const hp = game.u.uhp;
    initRng(4n);
    const input = resetInputState();

    await answerPrompts(beginMonsterMealMimicry(pony), input, [
        { prompt: /You can no longer ride[\s\S]*--More--/, keys: ' ' },
        { prompt: /tripe ration appear[\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(game.u.usteed, null);
    assert.equal(game.u.uhp, hp);
    assert.equal(pony.m_ap_type, M_AP_OBJECT);
});

void test('a sleeping mimic resumes its disguise when the last protective ring is removed', async () => {
    freshObjectRoom();
    const mimic = await createMonsterAt('small mimic', 11, 10);
    assert.notEqual(mimic.m_ap_type, M_AP_NOTHING);
    const leftRing = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    const rightRing = await addInventoryObject(RIN_PROTECTION_FROM_SHAPE_CHANGERS);
    await wearHeroAccessory(leftRing, 'uleft');
    await wearHeroAccessory(rightRing, 'uright');
    assert.equal(mimic.m_ap_type, M_AP_NOTHING);
    assert.equal(!!mimic.msleeping, true);

    await removeHeroAccessory(leftRing);
    assert.equal(mimic.m_ap_type, M_AP_NOTHING, 'The second ring still prevents disguise.');
    await removeHeroAccessory(rightRing);

    assert.notEqual(mimic.m_ap_type, M_AP_NOTHING);
    assert.equal(!!mimic.msleeping, true);
});
