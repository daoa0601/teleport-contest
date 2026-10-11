import { rhack } from '../js/cmd.js';
import type { KnownObjectOverrides } from './support/game-objects.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { A_INT, A_WIS, HUNGRY, M_SEEN_SLEEP, NOT_HUNGRY, SATIATED, WEAK } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsUnconscious } from '../js/hero_sleep.js';
import { wearEyewear } from '../js/eyewear.js';
import { resetInputState } from '../js/input.js';
import {
    POT_BLINDNESS, POT_BOOZE, POT_CONFUSION, POT_ENLIGHTENMENT,
    DUNCE_CAP, POT_GAIN_ABILITY, POT_HALLUCINATION, POT_PARALYSIS, POT_SLEEPING,
    RIN_FREE_ACTION,
} from '../js/object_data.js';
import { applyPotionMentalEffect } from '../js/potion_mental_effects.js';
import { grantIntrinsicProperty, revokeIntrinsicProperty } from '../js/properties.js';
import { heroIsBlind, heroIsHallucinating } from '../js/senses.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function effect(type: number, properties: KnownObjectOverrides = {}) {
    const potion = await knownObject(type, properties);
    resetInputState().feed(' '.repeat(30));
    return await applyPotionMentalEffect(potion);
}

void test('hallucination resistance leaves both perception and timeout unchanged', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('hallucinationResistance', 'outside');
    const result = await effect(POT_HALLUCINATION);
    assert.equal(result.nothing, true);
    assert.equal(game.u.hallucinationTurns ?? 0, 0);
    assert.equal(heroIsHallucinating(), false);
});

void test('cursed hallucination adds its native duration without enlightenment', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const result = await effect(POT_HALLUCINATION, { cursed: true });
    assert.equal(result.nothing, false);
    assert.ok((game.u.hallucinationTurns ?? 0) >= 900 && (game.u.hallucinationTurns ?? 0) <= 1099);
    assert.equal(heroIsHallucinating(), true);
    assert.match(game._pending_message, /cosmic/);
});

void test('repeated hallucination extends the timeout but reports no new effect', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 100 } });
    requirePlayingGame(game);
    const result = await effect(POT_HALLUCINATION, { cursed: true });
    assert.equal(result.nothing, true);
    assert.ok((game.u.hallucinationTurns ?? 0) >= 1000);
});

for (const [label, properties, minimum] of [
    ['blessed', { blessed: true }, 300], ['uncursed', {}, 600],
] as const) {
    void test(`${label} hallucination uses its native duration`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        await effect(POT_HALLUCINATION, properties);
        assert.ok((game.u.hallucinationTurns ?? 0) >= minimum
            && (game.u.hallucinationTurns ?? 0) <= minimum + 199);
        assert.equal(heroIsHallucinating(), true);
    });
}

void test('blessed booze heals and nourishes without confusion', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhunger: 140, uhs: HUNGRY } });
    requirePlayingGame(game);
    const result = await effect(POT_BOOZE, { blessed: true });
    assert.equal(result.unknown, 1);
    assert.equal(game.u.uhp, 21);
    assert.equal(game.u.uhunger, 170);
    assert.equal(game.u.uhs, NOT_HUNGRY);
    assert.equal(game.u.confusionTurns ?? 0, 0);
});

void test('diluted booze nourishes and confuses without healing', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhunger: 900, uhs: NOT_HUNGRY } });
    requirePlayingGame(game);
    await effect(POT_BOOZE, { odiluted: true });
    assert.equal(game.u.uhp, 20);
    assert.equal(game.u.uhunger, 920);
    assert.ok((game.u.confusionTurns ?? 0) >= 3 && (game.u.confusionTurns ?? 0) <= 24);
    assert.match(game._pending_message, /watered down liquid fire/);
});

void test('booze confusion hits a weak hero harder and preserves current-body healing', async () => {
    freshObjectRoom({ hero: { uhp: 20, uhunger: 20, uhs: WEAK } });
    requirePlayingGame(game);
    installPolymorphedHero('dog', { hitPoints: 5, maxHitPoints: 10 });
    await effect(POT_BOOZE);
    assert.equal(game.u.mh, 6);
    assert.equal(game.u.uhp, 20);
    assert.ok((game.u.confusionTurns ?? 0) >= 5 && (game.u.confusionTurns ?? 0) <= 40);
});

void test('drinking booze while satiated adds nutrition without meal choking', async () => {
    freshObjectRoom({ hero: { uhunger: 1995, uhs: SATIATED } });
    requirePlayingGame(game);
    await effect(POT_BOOZE, { blessed: true });
    assert.equal(game.u.uhunger, 2025);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game._helplessTurns ?? 0, 0);
});

void test('cursed booze causes unconsciousness and a headache wake-up message', async () => {
    freshObjectRoom({ hero: { uhunger: 900, uhs: NOT_HUNGRY } });
    requirePlayingGame(game);
    await effect(POT_BOOZE, { cursed: true });
    assert.equal(game.u.uhunger, 910);
    assert.ok((game._helplessTurns ?? 0) >= 1 && (game._helplessTurns ?? 0) <= 15);
    assert.equal(heroIsUnconscious(), true);
    assert.equal(game._helplessDoneMessage, 'You awake with a headache.');
});

void test('cursed enlightenment creates uncertainty without granting attributes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const result = await effect(POT_ENLIGHTENMENT, { cursed: true });
    assert.equal(result.unknown, 1);
    assert.equal(game.u.acurr.a[A_INT], 12);
    assert.equal(game.u.acurr.a[A_WIS], 12);
    assert.equal(game._pending_message, 'You have an uneasy feeling...');
});

void test('blessed enlightenment grants intelligence and wisdom before opening its real pages', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const potion = await knownObject(POT_ENLIGHTENMENT, { blessed: true });
    const input = resetInputState();
    const action = applyPotionMentalEffect(potion);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.u.acurr.a[A_INT], 13);
        assert.equal(game.u.acurr.a[A_WIS], 13);
    } finally {
        input.feed(' '.repeat(30));
        await action;
    }
    assert.equal(game._pending_message, 'The feeling subsides.');
});

for (const [label, properties, minimum] of [
    ['blessed', { blessed: true }, 13],
    ['uncursed', {}, 25],
    ['cursed', { cursed: true }, 37],
] as const) {
    void test(`${label} paralysis freezes the hero for its native duration`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        await effect(POT_PARALYSIS, properties);
        assert.ok((game._helplessTurns ?? 0) >= minimum && (game._helplessTurns ?? 0) <= minimum + 9);
        assert.equal(game.u.usleep ?? 0, 0);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.match(game._pending_message, /feet are frozen to the floor/);
    });
    void test(`${label} sleeping stops an occupation and causes sleep for its native duration`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        resetInputState().feed('6s');
        await rhack(0);
        assert.equal(game._occupation?.key, 'command');
        await effect(POT_SLEEPING, properties);
        assert.ok((game._helplessTurns ?? 0) >= minimum && (game._helplessTurns ?? 0) <= minimum + 9);
        assert.equal(game._occupation, null);
        assert.equal(heroIsUnconscious(), true);
        assert.equal(game._helplessDoneMessage, 'You wake up.');
    });
}

void test('an actually worn free-action ring prevents paralysis and sleep', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    resetInputState().feed(' ');
    await wearHeroAccessory(await addInventoryObject(RIN_FREE_ACTION), 'uleft');
    const paralysis = await effect(POT_PARALYSIS, { cursed: true });
    assert.equal(paralysis.nothing, false);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game._pending_message, 'You stiffen momentarily.');
    await effect(POT_SLEEPING, { cursed: true });
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.match(game._pending_message, /You yawn\.$/);
});

void test('visible monsters learn resisted sleep and forget it after an unresisted dose', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('dog', game.u.ux + 1, game.u.uy);
    grantIntrinsicProperty('sleepResistance', 'outside');
    await effect(POT_SLEEPING);
    assert.ok(monster.seen_resistance != null);
    assert.ok(monster.seen_resistance & M_SEEN_SLEEP);
    revokeIntrinsicProperty('sleepResistance', 'outside');
    await effect(POT_SLEEPING);
    assert.ok(monster.seen_resistance != null);
    assert.equal(monster.seen_resistance & M_SEEN_SLEEP, 0);
});

void test('a sleeping dose preserves a longer paralysis but changes recovery to waking up', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await effect(POT_PARALYSIS, { cursed: true });
    const paralysis = game._helplessTurns;
    await effect(POT_SLEEPING, { blessed: true });
    assert.equal(game._helplessTurns, paralysis);
    assert.equal(heroIsUnconscious(), true);
    assert.equal(game._helplessReason, 'sleeping');
    assert.equal(game._helplessDoneMessage, 'You wake up.');
});

void test('levitation changes paralysis feedback without changing its delay', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    await effect(POT_PARALYSIS);
    assert.equal(game._pending_message, 'You are motionlessly suspended.');
    assert.ok((game._helplessTurns ?? 0) >= 25 && (game._helplessTurns ?? 0) <= 34);
});

void test('repeated confusion accumulates duration without identifying a new sensation', async () => {
    freshObjectRoom({ hero: { confusionTurns: 10 } });
    requirePlayingGame(game);
    const result = await effect(POT_CONFUSION, { blessed: true });
    assert.equal(result.nothing, true);
    assert.ok((game.u.confusionTurns ?? 0) >= 18 && (game.u.confusionTurns ?? 0) <= 24);
});

void test('confusion during hallucination produces ambiguous trippy feedback', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 100 } });
    requirePlayingGame(game);
    const result = await effect(POT_CONFUSION, { cursed: true });
    assert.equal(result.unknown, 1);
    assert.equal(game._pending_message, 'What a trippy feeling!');
    assert.ok((game.u.confusionTurns ?? 0) >= 24 && (game.u.confusionTurns ?? 0) <= 30);
});

void test('blessed gain ability raises every available base attribute', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    await effect(POT_GAIN_ABILITY, { blessed: true });
    assert.ok(game.u.acurr.a.every(value => value === 13));
});

void test('uncursed gain ability raises one attribute', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await effect(POT_GAIN_ABILITY);
    assert.equal(game.u.acurr.a.filter(value => value === 13).length, 1);
    assert.equal(game.u.acurr.a.filter(value => value === 12).length, 5);
});

void test('cursed gain ability tastes foul without altering attributes', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const result = await effect(POT_GAIN_ABILITY, { cursed: true });
    assert.equal(result.unknown, 1);
    assert.ok(game.u.acurr.a.every(value => value === 12));
    assert.equal(game._pending_message, 'Ulch!  That potion tasted foul!');
});

void test('sustain ability prevents gains and reports no effective change', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('sustainAbility', 'outside');
    const result = await effect(POT_GAIN_ABILITY, { blessed: true });
    assert.equal(result.nothing, true);
    assert.ok(game.u.acurr.a.every(value => value === 12));
});

void test('blessed gain ability leaves attributes at their racial maxima and reports the limit', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a = [...game.urace.attrmax];
    game.u.amax.a = [...game.urace.attrmax];
    const charisma = game.u.acurr.a[5];
    await effect(POT_GAIN_ABILITY, { blessed: true });
    assert.equal(game.u.acurr.a[5], charisma);
    assert.match(game._pending_message, /already as charismatic as you can get/);
});

void test('a worn dunce cap blocks intellect gains even when ordinary verbosity is off', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.u.acurr.a = [...game.urace.attrmax];
    game.u.amax.a = [...game.urace.attrmax];
    game.u.acurr.a[A_INT] = game.u.acurr.a[A_WIS] = 12;
    await wearHeroArmor(await addInventoryObject(DUNCE_CAP));
    const potion = await knownObject(POT_GAIN_ABILITY, { blessed: true });
    const input = resetInputState();
    const action = applyPotionMentalEffect(potion);
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /cap constricts briefly/);
    } finally {
        input.feed(' '.repeat(30));
        await action;
    }
    assert.equal(game.u.acurr.a[A_INT], 12);
    assert.equal(game.u.acurr.a[A_WIS], 12);
});

void test('blindness applies a timeout and repeated blindness extends it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const first = await effect(POT_BLINDNESS, { blessed: true });
    const initial = game.u.blindTurns;
    assert.ok(initial !== undefined);
    assert.equal(first.nothing, false);
    assert.ok(initial != null);
    assert.ok(initial >= 125 && initial <= 324);
    assert.equal(heroIsBlind(), true);
    const second = await effect(POT_BLINDNESS, { cursed: true });
    assert.equal(second.nothing, true);
    assert.ok(initial != null);
    assert.ok((game.u.blindTurns ?? 0) >= initial + 375 && (game.u.blindTurns ?? 0) <= initial + 574);
});

void test('the Eyes mask new potion blindness and repeated doses retain the underlying timeout', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await wearEyewear(await artifactObject('The Eyes of the Overworld'));
    const first = await effect(POT_BLINDNESS);
    const initial = game.u.blindTurns;
    assert.ok(initial !== undefined);
    assert.equal(first.nothing, false);
    assert.equal(heroIsBlind(), false);
    const repeated = await effect(POT_BLINDNESS);
    assert.equal(repeated.nothing, true);
    assert.ok(initial != null);
    assert.ok((game.u.blindTurns ?? 0) > initial);
    assert.equal(heroIsBlind(), false);
});
