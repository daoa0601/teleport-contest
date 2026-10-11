import type { GameplayRoomOptions } from './support/playable-room.js';
import type { GameObject } from '../js/object_types.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CORR, SCORR, SDOOR, W_ARM } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { setHeroSpecies } from '../js/hero_species.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLUB, OBJECT_NAMES, POT_HEALING, SCR_IDENTIFY, SPE_DIG } from '../js/object_data.js';
import { applyScrollEffects, identifyEffect } from '../js/scroll_effects.js';
import { makeShopkeeperHappy } from '../js/shop_damage.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';

function room(options: GameplayRoomOptions = {}) {
    const level = freshGameplayRoom(options);
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return level;
}

async function spellSource(name: string, { blessed, cursed }: Pick<Partial<GameObject>, 'blessed' | 'cursed'> = {}) {
    const source = await mksobj(OBJECT_NAMES.indexOf(name, SPE_DIG), false, false);
    source.quan = 20;
    source.quantity = 20;
    if (blessed !== undefined) source.blessed = blessed;
    if (cursed !== undefined) source.cursed = cursed;
    return source;
}

void test('remove curse spell uses its blessing without reading or consuming an object', async () => {
    room();
    requirePlayingGame(game);
    const worn = await addInventoryObject(CLUB, { cursed: true, owornmask: W_ARM });
    const carried = await addInventoryObject(CLUB, { cursed: true });
    const source = await spellSource('remove curse');

    await applyScrollEffects(source);

    assert.equal(worn.cursed, false);
    assert.equal(carried.cursed, true);
    assert.equal(source.quan, 20);
    assert.equal(game.u.uconduct.literate ?? 0, 0);
    assert.equal(game._knownObjectTypes?.has(source.otyp) ?? false, false);

    source.blessed = true;
    await applyScrollEffects(source);
    assert.equal(carried.cursed, false);
});

void test('confuse monster charges the hands and repeated casting has diminishing returns', async () => {
    room();
    requirePlayingGame(game);
    const source = await spellSource('confuse monster');

    await applyScrollEffects(source);

    assert.ok(game.u.umconf != null, 'Expected game.u.umconf to be initialized');
    assert.ok(game.u.umconf >= 1 && game.u.umconf <= 2);
    assert.equal(game.u.confusionTurns ?? 0, 0);
    game.u.umconf = 40;
    source.blessed = true;
    await applyScrollEffects(source);
    assert.equal(game.u.umconf, 41);
});

void test('blessed confusion magic cures confusion only in a human-shaped form', async () => {
    room();
    requirePlayingGame(game);
    game.u.confusionTurns = 8;
    const source = await spellSource('confuse monster', { blessed: true });

    await applyScrollEffects(source);

    assert.equal(game.u.confusionTurns, 0);
    setHeroSpecies(MONSTER_NAME.indexOf('giant ant'));
    await applyScrollEffects(source);
    assert.ok(game.u.confusionTurns >= 1 && game.u.confusionTurns <= 100);
    assert.equal(game.u.umconf ?? 0, 0);
});

void test('cause fear frightens monsters on visible squares, including unseen monsters', async () => {
    room();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10);
    ant.minvis = true;
    vision_recalc(0);

    await applyScrollEffects(await spellSource('cause fear'));

    assert.equal(ant.mflee, 1);
    assert.equal(ant.mfleetim, 0);
});

void test('confused fear magic removes fear, sleep, and paralysis', async () => {
    room();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10);
    ant.mflee = 1;
    ant.mfleetim = 12;
    ant.msleeping = 1;
    ant.mfrozen = 8;
    ant.mcanmove = 0;
    game.u.confusionTurns = 4;
    vision_recalc(0);

    await applyScrollEffects(await spellSource('cause fear'));

    assert.equal(ant.mflee, 0);
    assert.equal(ant.msleeping, 0);
    assert.equal(ant.mfrozen, 0);
    assert.equal(ant.mcanmove, 1);
});

void test('charm tames an animal and only pacifies a human', async () => {
    room();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10);
    const human = await createMonsterAt('soldier', 10, 11);
    ant.mpeaceful = human.mpeaceful = 0;

    await applyScrollEffects(await spellSource('charm monster'));

    assert.equal(ant.mtame, 5);
    assert.equal(ant.mpeaceful, 1);
    assert.equal(!!human.mtame, false);
    assert.equal(human.mpeaceful, 1);
});

void test('blessed charm increases a weak bond without resetting pet history', async () => {
    room();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10);
    initializePet(ant);
    ant.mtame = 2;
    assert.ok(ant.edog != null, 'Expected ant.edog to be initialized');
    ant.edog.abuse = 3;
    const history = ant.edog;

    await applyScrollEffects(await spellSource('charm monster', { blessed: true }));

    assert.ok(ant.mtame >= 4 && ant.mtame <= 5);
    assert.equal(ant.edog, history);
    assert.equal(ant.edog.abuse, 3);
});

void test('charm shortens paralysis but cannot make a paralyzed monster tame', async () => {
    room();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10);
    ant.mfrozen = 9;
    ant.mcanmove = 0;
    ant.msleeping = 1;
    ant.mpeaceful = 0;

    await applyScrollEffects(await spellSource('charm monster'));

    assert.equal(ant.mfrozen, 5);
    assert.equal(ant.mcanmove, 0);
    assert.equal(ant.msleeping, 0);
    assert.equal(ant.mpeaceful, 1);
    assert.equal(!!ant.mtame, false);
});

void test('charm pacifies a pursuing shopkeeper while retaining the open bill', async () => {
    room();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.mpeaceful = 0;
    shopkeeper.eshk.following = 1;
    shopkeeper.eshk.robbed = 120;
    shopkeeper.eshk.debit = 30;
    game.u.ualign.record = 5;
    const alignment = game.u.ualign.record;

    await applyScrollEffects(await spellSource('charm monster'));

    assert.equal(shopkeeper.mpeaceful, 1);
    assert.equal(!!shopkeeper.mtame, false);
    assert.equal(shopkeeper.eshk.following, 0);
    assert.equal(shopkeeper.eshk.robbed, 0);
    assert.equal(shopkeeper.eshk.debit, 30);
    assert.equal(game.u.ualign.record, alignment + 1);
});

void test('identify spell identifies carried possessions and leaves its source intact', async () => {
    room();
    requirePlayingGame(game);
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false, typeKnown: false });
    const source = await spellSource('identify');

    await applyScrollEffects(source);

    assert.equal(potion.known, true);
    assert.equal(potion.bknown, true);
    assert.equal(source.quan, 20);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_IDENTIFY), false);
});

void test('a previously unknown cursed identify scroll identifies only itself', async () => {
    room();
    requirePlayingGame(game);
    const scroll = await addInventoryObject(SCR_IDENTIFY, { cursed: true, typeKnown: false });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false, typeKnown: false });
    game._knownObjectTypes?.delete(SCR_IDENTIFY);

    await identifyEffect(scroll);

    assert.equal(game.inventory.includes(scroll), false);
    assert.equal(potion.known, false);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_IDENTIFY), true);
});

void test('mapping on a forbidden level confuses the caster without mapping', async () => {
    const level = room();
    requirePlayingGame(game);
    level.flags.nommap = true;
    const unseen = level.requireAt(30, 10);
    unseen.seenv = 0;

    await applyScrollEffects(await spellSource('magic mapping'));

    assert.ok(game.u.confusionTurns != null, 'Expected game.u.confusionTurns to be initialized');
    assert.ok(game.u.confusionTurns >= 1 && game.u.confusionTurns <= 30);
    assert.equal(unseen.seenv, 0);
});

void test('create monster spell uses ordinary monster construction', async () => {
    room();
    requirePlayingGame(game);
    const source = await spellSource('create monster');

    await applyScrollEffects(source);

    assert.ok(game.level.monsters.length >= 1 && game.level.monsters.length <= 5);
    assert.ok(game.level.monsters.every(monster => monster.mhp > 0 && monster.mcansee));
    assert.equal(source.quan, 20);
});


void test('mapping spell reveals secret corridors while keeping secret doors hidden', async () => {
    const level = room();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = SCORR;
    level.requireAt(31, 10).typ = SDOOR;
    level.requireAt(30, 10).seenv = level.requireAt(31, 10).seenv = 0;

    await applyScrollEffects(await spellSource('magic mapping', { blessed: true }));

    assert.equal(level.requireAt(30, 10).typ, CORR);
    assert.equal(level.requireAt(30, 10).seenv, 255);
    assert.equal(level.requireAt(31, 10).typ, SDOOR);
});

void test('confused creation summons acid blobs through ordinary births', async () => {
    room({ left: 1, right: 50, top: 1, bottom: 19 });
    requirePlayingGame(game);
    game.u.confusionTurns = 5;

    await applyScrollEffects(await spellSource('create monster', { blessed: true }));

    assert.equal(game.level.monsters.length, 13);
    assert.ok(game.level.monsters.every(monster => MONSTER_NAME[monster.mnum] === 'acid blob'));
});

void test('identify waits for a selection and identifies only the chosen object', async () => {
    room();
    requirePlayingGame(game);
    const club = await addInventoryObject(CLUB, { known: false, bknown: false });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const source = await spellSource('identify', { cursed: true });
    const input = resetInputState();
    const identification = applyScrollEffects(source);
    await input.waitUntilBlocked();

    assert.equal(potion.known, false);
    input.feed(`${potion.invlet}\n`);
    await identification;

    assert.equal(club.known, false);
    assert.equal(potion.known, true);
    assert.equal(source.quan, 20);
});


void test('a pacified shopkeeper returns home and ends the local police pursuit', async () => {
    room();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const kop = await createMonsterAt('Keystone Kop', 16, 10);
    const guard = await createMonsterAt('watchman', 17, 10);
    guard.mpeaceful = 0;
    await relocateMonsterTo(shopkeeper, 15, 10);
    shopkeeper.mpeaceful = 0;
    shopkeeper.eshk.following = 1;

    await makeShopkeeperHappy(shopkeeper);

    assert.equal(shopkeeper.mx, shopkeeper.eshk.shk.x);
    assert.equal(shopkeeper.my, shopkeeper.eshk.shk.y);
    assert.equal(game.level.monsters.includes(kop), false);
    assert.equal(guard.mpeaceful, 1);
    assert.equal(shopkeeper.eshk.following, 0);
});

void test('renewed charm preserves a strong pet bond and its feeding history', async () => {
    room();
    requirePlayingGame(game);
    const pet = await createMonsterAt('jackal', 11, 10);
    initializePet(pet);
    pet.mtame = 15;
    assert.ok(pet.edog != null, 'Expected pet.edog to be initialized');
    pet.edog.hungrytime = game.moves + 2000;
    pet.edog.abuse = 2;
    pet.meating = 8;
    const petHistory = pet.edog;

    await applyScrollEffects(await spellSource('charm monster'));

    assert.equal(pet.mtame, 15);
    assert.equal(pet.edog, petHistory);
    assert.equal(pet.edog.hungrytime, game.moves + 2000);
    assert.equal(pet.edog.abuse, 2);
    assert.equal(pet.meating, 8);
});
