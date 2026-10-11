import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, G_GENOD, ICE, NO_MINVENT, WEB } from '../js/const.js';
import { moveloop_core } from '../js/allmain.js';
import { doeat } from '../js/eat.js';
import { flushPendingTopline } from '../js/display.js';
import { heroIsUnconscious } from '../js/hero_sleep.js';
import { addInventoryItem } from '../js/u_init.js';
import { races } from '../js/roles.js';
import { game, requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { APPLE, CARROT, CLOVE_OF_GARLIC, EGG, FOOD_RATION, FORTUNE_COOKIE, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, PEAR, TRIPE_RATION, } from '../js/object_data.js';
import { applyOrdinaryFoodFirstBite, applyOrdinaryFoodPostEffects, applyRottenFood, } from '../js/ordinary_food_effects.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { heroIsBlind, heroIsDeaf, setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { applyInventoryObject } from './support/commands.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function foodRoom(options = {}) {
    const level = freshObjectRoom(options);
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /food|egg|garlic|wafer|ration|cookie|fortune|jelly|read|blind|vision|spins|unconscious|conscious|hear|Blecch|feel|Splat|fire|flame|explosion|vortex|burn|dark/i,
        limit: 16,
    });
    return level;
}
void test('biting a pyrolisk egg consumes it before its fire explosion', async () => {
    const level = foodRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('fireResistance', 'potion');
    const egg = await addInventoryObject(EGG, { corpsenm: MONSTER_NAME.indexOf('pyrolisk') });
    const web = addTrap(level, WEB, game.u.ux + 1, game.u.uy, { tseen: true });
    const result = await applyOrdinaryFoodFirstBite(egg);
    assert.equal(result.continueMeal, false);
    assert.equal(result.heroDied, false);
    assert.equal(game.inventory.includes(egg), false);
    assert.equal(egg.where, 'gone');
    assert.equal(level.traps.includes(web), false);
});
void test('a stale egg extends nausea even when the hero is already vomiting', async () => {
    foodRoom();
    requirePlayingGame(game);
    game.u.vomiting = true;
    game.u.vomitingTurns = 12;
    const egg = await addInventoryObject(EGG, { age: game.moves - 401, corpsenm: -1 });
    const result = await applyOrdinaryFoodFirstBite(egg);
    assert.equal(result.continueMeal, true);
    assert.ok(game.u.vomitingTurns >= 22 && game.u.vomitingTurns <= 52);
    assert.equal(game._pending_message, 'Ugh.  Rotten egg.');
});
void test('tripe rewards an ordinary human with experience but animal forms enjoy it', async () => {
    for (const form of ['human', 'large dog']) {
        foodRoom({ role: 'wizard' });
        requirePlayingGame(game);
        if (form !== 'human')
            installPolymorphedHero(form);
        const tripe = await addInventoryObject(TRIPE_RATION);
        const experience = game.u.uexp || 0;
        assert.ok(tripe.invlet);
        pushKeys(tripe.invlet);
        await doeat();
        assert.equal(game.u.uexp || 0, experience + (form === 'human' ? 1 : 0));
        assert.match(game._pending_message, form === 'human' ? /Yak - dog food!/ : /surprisingly good!/);
    }
});
void test('lembas preference follows the polymorphed species instead of the birth race', async () => {
    const race = races.find(candidate => candidate.name === 'orc');
    assert.ok(race);
    foodRoom({ race });
    requirePlayingGame(game);
    installPolymorphedHero('elf');
    const wafer = await addInventoryObject(LEMBAS_WAFER);
    await applyOrdinaryFoodFirstBite(wafer);
    assert.equal(game._pending_message, 'A little goes a long way.');
});
void test('garlic nauseates undead forms without frightening nearby monsters', async () => {
    foodRoom();
    requirePlayingGame(game);
    installPolymorphedHero('vampire');
    const ant = await createMonsterAt('giant ant', 11, 10, NO_MINVENT);
    const garlic = await addInventoryObject(CLOVE_OF_GARLIC);
    assert.ok(garlic.invlet);
    pushKeys(garlic.invlet);
    await doeat();
    assert.equal(game.u.vomitingTurns, 5);
    assert.equal(ant.mflee || 0, 0);
});
void test('an ordinary garlic bite frightens nearby creatures that can smell', async () => {
    foodRoom();
    requirePlayingGame(game);
    const ant = await createMonsterAt('giant ant', 11, 10, NO_MINVENT);
    const blob = await createMonsterAt('acid blob', 10, 11, NO_MINVENT);
    const garlic = await addInventoryObject(CLOVE_OF_GARLIC);
    await applyOrdinaryFoodFirstBite(garlic);
    assert.equal(!!ant.mflee, true);
    assert.equal(blob.mflee || 0, 0);
    assert.match(game._pending_message, /This clove of garlic is delicious!/);
});
void test('the configured native build gives apples Mac feedback and pears UNIX feedback', async () => {
    for (const [type, message] of [[APPLE, 'Delicious!  Must be a Macintosh!'], [PEAR, 'Core dumped.']]) {
        foodRoom();
        requirePlayingGame(game);
        const fruit = await addInventoryObject(type);
        await applyOrdinaryFoodFirstBite(fruit);
        assert.equal(game._pending_message, message);
    }
});
void test('a ration names the current form stomach', async () => {
    foodRoom({ hero: { uhunger: 500 } });
    requirePlayingGame(game);
    installPolymorphedHero('giant spider');
    const ration = await addInventoryObject(FOOD_RATION);
    await applyOrdinaryFoodFirstBite(ration);
    assert.equal(game._pending_message, 'This satiates your digestive tract!');
});
void test('carrots do not clear the blindness of a swallowing dust vortex', async () => {
    foodRoom();
    requirePlayingGame(game);
    const vortex = await createMonsterAt('dust vortex', 11, 10, NO_MINVENT);
    game.u.uswallow = 1;
    game.u.ustuck = vortex;
    setHeroBlindnessTurns(15);
    const carrot = await addInventoryObject(CARROT);
    await applyOrdinaryFoodPostEffects(carrot);
    assert.equal(game.u.blindTurns, 15);
});
void test('fortune cookies record the first reading once, while blind reading breaks no literacy conduct', async () => {
    foodRoom();
    requirePlayingGame(game);
    const eatCookie = async () => {
        const cookie = await addInventoryObject(FORTUNE_COOKIE);
        assert.ok(cookie.invlet);
        pushKeys(cookie.invlet);
        await doeat();
        assert.equal(cookie.where, 'gone');
    };
    setHeroBlindnessTurns(5);
    await eatCookie();
    assert.equal(game.u.uconduct.literate || 0, 0);
    pushKeys(' ');
    await flushPendingTopline();
    setHeroBlindnessTurns(0);
    await eatCookie();
    // A rumor is variable prose. Dismiss its final public message before
    // opening another cookie.
    assert.ok(game._pending_message);
    pushKeys(' ');
    await flushPendingTopline();
    await eatCookie();
    assert.equal(game.u.uconduct.literate, 2);
    const readingEvents = gameLogEvents().map(event => event.text)
        .filter(text => /literate/.test(text));
    assert.deepEqual(readingEvents, [
        'became literate by reading the fortune inside a cookie',
    ]);
});
void test('royal jelly still strengthens a killer bee when queen bees are genocided', async () => {
    foodRoom();
    requirePlayingGame(game);
    installPolymorphedHero('killer bee');
    const queen = MONSTER_NAME.indexOf('queen bee');
    requireMonsterVital(queen).mvflags |= G_GENOD;
    const strength = game.u.acurr.a[A_STR];
    const jelly = await addInventoryObject(LUMP_OF_ROYAL_JELLY);
    await applyOrdinaryFoodPostEffects(jelly);
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('killer bee'));
    assert.equal(game.u.acurr.a[A_STR], strength + 1);
});
void test('rotten food confuses a fungus using its native sensation', async () => {
    foodRoom();
    requirePlayingGame(game);
    installPolymorphedHero('brown mold');
    game.u.confusionTurns = 3;
    const ration = await addInventoryObject(FOOD_RATION);
    initRng(5n);
    const passedOut = await applyRottenFood(ration);
    assert.equal(passedOut, false);
    assert.ok(game.u.confusionTurns >= 5 && game.u.confusionTurns <= 11);
    assert.match(game._pending_message, /You feel rather sporulated\./);
    assert.equal(heroIsUnconscious(), false);
});
void test('rotten food extends masked blindness while the Eyes preserve sight', async () => {
    foodRoom({ role: 'monk' });
    requirePlayingGame(game);
    game.u.ualign.type = 0;
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    resetInputState();
    await applyInventoryObject(eyes);
    pushKeys(' ');
    await flushPendingTopline();
    installPagerInput(resetInputState(), { expected: /Blecch|dark|vision/i, limit: 4 });
    setHeroBlindnessTurns(5);
    const ration = await addInventoryObject(FOOD_RATION);
    initRng(7n);
    await applyRottenFood(ration);
    assert.ok((game.u.blindTurns ?? 0) > 5);
    assert.equal(heroIsBlind(), false);
    assert.match(game._pending_message, /Your vision clears\./);
});
void test('a blind hero who faints from rotten food feels the actual surface', async () => {
    const level = foodRoom();
    requirePlayingGame(game);
    level.requireAt(game.u.ux, game.u.uy).typ = ICE;
    setHeroBlindnessTurns(30);
    const ration = await addInventoryObject(FOOD_RATION);
    initRng(1n);
    const passedOut = await applyRottenFood(ration);
    assert.equal(passedOut, true);
    assert.equal(heroIsDeaf(), true);
    assert.equal(heroIsUnconscious(), true);
    assert.match(game._pending_message, /The world spins and you slap against the ice\./);
});
void test('rotten-food unconsciousness and temporary deafness end through ordinary turns', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const ration = await addInventoryObject(FOOD_RATION);
    const messages = [];
    let reads = 0;
    input.display = { async readKey() {
            const display = requireGameDisplay(game);
            const row = display.grid[0];
            assert.ok(row);
            const topline = row.map(cell => cell.ch).join('');
            const message = game._pending_message || topline;
            messages.push(message);
            assert.ok(++reads <= 16, `Unexpected recovery input: ${message}`);
            if (topline.includes('--More--')) {
                assert.match(message, /Blecch|world spins|conscious|hear/i);
                return ' '.charCodeAt(0);
            }
            assert.equal(heroIsUnconscious(), false, `Unconscious hero requested a command: ${message}`);
            return 27;
        } };
    initRng(1n);
    await applyRottenFood(ration);
    assert.equal(heroIsUnconscious(), true);
    const start = game.moves;
    for (let turn = 0; turn < 20 && heroIsUnconscious(); turn++)
        await moveloop_core();
    await moveloop_core();
    assert.ok(game.moves > start);
    assert.equal(heroIsUnconscious(), false);
    assert.equal(heroIsDeaf(), false);
    assert.match(messages.join('\n'), /You are conscious again\./);
});
//# sourceMappingURL=ordinary_food_effects.test.js.map