import type { KnownObjectOverrides } from './support/game-objects.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { DOOR, SDOOR, W_ARM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    CLUB, OBJECT_NAMES, POT_HEALING, SACK, SCR_IDENTIFY, SCR_LIGHT,
    SCR_MAGIC_MAPPING, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyScrollEffects } from '../js/scroll_effects.js';
import { learnScroll, learnScrollType } from '../js/scroll_discovery.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { vision_recalc } from '../js/vision.js';

function room() {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return level;
}

async function scroll(otyp: number, overrides: KnownObjectOverrides = {}) {
    const object = await addInventoryObject(otyp, {
        known: true, dknown: true, bknown: true, typeKnown: false,
        blessed: false, cursed: false, ...overrides,
    });
    game._knownObjectTypes?.delete(otyp);
    return object;
}

void test('scroll discovery grants its score award once and never discovers a spellbook source', async () => {
    room();
    requirePlayingGame(game);
    const source = await scroll(SCR_LIGHT);
    const before = game.u.urexp ?? 0;

    assert.equal(learnScroll(source), true);
    assert.equal(learnScrollType(source.otyp), false);
    assert.equal(game.u.urexp, before + 10);
    const spell = await scroll(OBJECT_NAMES.indexOf('light', OBJECT_NAMES.indexOf('dig')));
    assert.equal(learnScroll(spell), false);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(spell.otyp), false);
    assert.equal(game.u.urexp, before + 10);
});

void test('blessed mapping scroll reveals secret doors and leaves ordinary consumption to the reader', async () => {
    const level = room();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = SDOOR;
    const source = await scroll(SCR_MAGIC_MAPPING, { blessed: true, quan: 2, quantity: 2 });

    const result = await applyScrollEffects(source);

    assert.equal(level.requireAt(30, 10).typ, DOOR);
    assert.equal(result.known, true);
    assert.equal(result.consumed, false);
    assert.equal(source.quan, 2);
});

void test('identify consumes one scroll before identifying the remaining possessions', async () => {
    room();
    requirePlayingGame(game);
    const source = await scroll(SCR_IDENTIFY, { quan: 2, quantity: 2 });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const before = game.u.urexp ?? 0;

    const result = await applyScrollEffects(source);

    assert.equal(result.consumed, true);
    assert.equal(result.known, false);
    assert.equal(source.quan, 1);
    assert.equal(potion.known, true);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_IDENTIFY), true);
    assert.equal(game.u.urexp, before + 10);
});

void test('recognizing an uncursed possession discovers remove curse immediately', async () => {
    room();
    requirePlayingGame(game);
    const source = await scroll(SCR_REMOVE_CURSE);
    const worn = await addInventoryObject(CLUB, { cursed: true, bknown: true, owornmask: W_ARM });
    const before = game.u.urexp ?? 0;

    const result = await applyScrollEffects(source);

    assert.equal(worn.cursed, false);
    assert.equal(result.known, false);
    assert.equal(result.consumed, false);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SCR_REMOVE_CURSE), true);
    assert.equal(game.u.urexp, before + 10);
});

void test('scare monster scroll gives nearby laughter without automatically discovering its type', async () => {
    room();
    requirePlayingGame(game);
    const monster = await createMonsterAt('giant ant', 11, 10);
    const source = await scroll(SCR_SCARE_MONSTER);
    vision_recalc(0);

    const result = await applyScrollEffects(source);

    assert.equal(monster.mflee, 1);
    assert.match(game._pending_message, /maniacal laughter close by/);
    assert.equal(result.known, false);
    assert.equal(game._knownObjectTypes?.has(source.otyp) ?? false, false);
});

void test('failed food detection waits for type naming before consuming its scroll', async () => {
    room();
    requirePlayingGame(game);
    const source = await scroll(OBJECT_NAMES.indexOf('food detection'));
    const input = resetInputState();
    const effect = applyScrollEffects(source);
    await input.waitUntilBlocked();
    assert.equal(game.inventory.includes(source), true);
    assert.match(game._pending_message, /nose twitches/);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /Call a scroll/);

    input.feed('food finder\n');
    const result = await effect;

    assert.equal(result.consumed, true);
    assert.equal(result.known, false);
    assert.equal(game.inventory.includes(source), false);
    assert.ok(game._objectCallNames != null, 'Expected game._objectCallNames to be initialized');
    assert.equal(game._objectCallNames?.[source.otyp], 'food finder');
});

for (const postage of [false, true]) {
    void test(`mail scroll displays its native ${postage ? 'postage' : 'junk-mail'} text`, async () => {
        room();
        requirePlayingGame(game);
        const source = await scroll(OBJECT_NAMES.indexOf('mail'), { spe: postage ? 2 : 1 });
        const odd = source.o_id % 2 === 1;

        const result = await applyScrollEffects(source);

        const expected = postage ? (odd ? 'Postage Due' : 'Return to Sender')
            : odd ? 'a chain letter threatening your luck' : 'junk mail addressed to the finder of the Eye of Larn';
        assert.ok(game._pending_message.includes(expected));
        assert.equal(result.known, true);
        assert.equal(result.consumed, false);
    });
}

void test('a lucky blessed identify scroll identifies a second possession', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    // A carried luckstone keeps C's Luck (uluck + moreluck) positive even
    // though the base luck record is neutral.
    game.u.uluck = 0;
    game.u.moreluck = 3;
    const first = await addInventoryObject(CLUB, { known: false, bknown: false });
    const second = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const third = await addInventoryObject(SACK, { known: false, bknown: false });
    const source = await scroll(SCR_IDENTIFY, { blessed: true });
    const input = resetInputState();
    // The blessed identification count is the effect's first random roll;
    // land it on one so only Luck can raise the count to two.
    initRng(3n);
    input.feed(` ${first.invlet}\n ${second.invlet}\n`);
    const result = await applyScrollEffects(source);

    assert.equal(result.consumed, true);
    assert.equal(first.known, true, 'the first menu choice must be identified');
    assert.equal(second.known, true, 'Luck must raise the blessed count from one to two');
    assert.equal(third.known, false);
});
