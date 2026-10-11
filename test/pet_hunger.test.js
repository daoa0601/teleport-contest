import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, STONE, W_AMUL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, LEASH, ROCK } from '../js/object_data.js';
import { applyPetHunger } from '../js/pet_hunger.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function pet(species = 'little dog', x = 12, y = 10) {
    const monster = await createMonsterAt(species, x, y, NO_MINVENT);
    initializePet(monster);
    assert.ok(monster.edog);
    monster.mhp = monster.mhpmax = 29;
    monster.edog.hungrytime = 100;
    return monster;
}
async function topline() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('hunger weakens a pet at its movement opportunity after the native grace period', async () => {
    freshObjectRoom({ moves: 600 });
    requirePlayingGame(game);
    const dog = await pet();
    assert.ok(dog.edog);
    await runMonsterAction(dog, game);
    assert.equal(dog.mhpmax, 29);
    game.moves++;
    await runMonsterAction(dog, game);
    assert.equal(dog.mhpmax, 9);
    assert.equal(dog.mhp, 9);
    assert.equal(dog.edog.mhpmax_penalty, 20);
    assert.equal(dog.mconf, 1);
    assert.match(await topline(), /is confused from hunger\./);
});
void test('new hunger weakness clamps health without healing an injured pet', async () => {
    freshObjectRoom({ moves: 601 });
    const dog = await pet();
    dog.mhp = 4;
    assert.equal(await applyPetHunger(dog, game), false);
    assert.equal(dog.mhp, 4);
    assert.equal(dog.mhpmax, 9);
});
void test('a pet first noticed overdue becomes weak before a later action can starve it', async () => {
    freshObjectRoom({ moves: 1000 });
    const dog = await pet();
    const starved = await applyPetHunger(dog, game);
    assert.equal(starved, false);
    assert.ok(dog.mhp > 0);
    assert.ok(game.level?.monsters.includes(dog));
    assert.equal(dog.mhpmax, 9);
});
for (const [description, condition] of [
    ['frozen', 'frozen'], ['still chewing', 'eating'],
]) {
    void test(`a ${description} pet waits for its next movement opportunity before hunger weakness`, async () => {
        freshObjectRoom({ moves: 1000 });
        requirePlayingGame(game);
        const dog = await pet();
        if (condition === 'frozen') {
            dog.mcanmove = 0;
            dog.mfrozen = 2;
        }
        else
            dog.meating = 2;
        await runMonsterAction(dog, game);
        assert.equal(dog.mhpmax, 29);
        assert.equal(dog.edog?.mhpmax_penalty, 0);
    });
}
void test('an already weak pet starves only after its starvation deadline and releases its leash', async () => {
    freshObjectRoom({ moves: 850 });
    requirePlayingGame(game);
    const dog = await pet();
    assert.ok(dog.edog);
    dog.mhp = dog.mhpmax = 9;
    dog.edog.mhpmax_penalty = 20;
    const leash = await addInventoryObject(LEASH, { leashmon: dog.m_id });
    dog.mleashed = 1;
    const rock = await knownObject(ROCK);
    await equipMonsterObject(dog, rock, 0);
    const experience = game.u.uexp;
    assert.equal(await applyPetHunger(dog, game), false);
    game.moves++;
    assert.equal(await applyPetHunger(dog, game), true);
    assert.equal(dog.dead, true);
    assert.equal(leash.leashmon, 0);
    assert.equal(rock.where, 'floor');
    assert.equal(game.u.uexp, experience);
    assert.match(await topline(), /Your leash goes slack\./);
});
void test('a frail pet can starve immediately when weakness removes its last hit point', async () => {
    freshObjectRoom({ moves: 601 });
    const dog = await pet();
    dog.mhp = dog.mhpmax = 2;
    assert.equal(await applyPetHunger(dog, game), true);
    assert.equal(dog.dead, true);
    assert.match(await topline(), /little dog starves\./);
});
void test('a form which eats neither meat nor plants postpones hunger without inventing recovery', async () => {
    freshObjectRoom({ moves: 601 });
    const golem = await pet('iron golem');
    assert.ok(golem.edog);
    golem.edog.mhpmax_penalty = 20;
    assert.equal(await applyPetHunger(golem, game), false);
    assert.equal(golem.edog.hungrytime, 1101);
    assert.equal(golem.edog.mhpmax_penalty, 20);
    assert.equal(golem.mhpmax, 29);
    assert.equal(await topline(), '');
});
void test('an unseen starving pet causes sadness without naming a visible death', async () => {
    freshObjectRoom({ moves: 851, right: 20 });
    requirePlayingGame(game);
    const dog = await pet('little dog', 18, 10);
    assert.ok(dog.edog);
    dog.edog.mhpmax_penalty = 20;
    for (let y = 0; y < 21; y++)
        game.level.requireAt(15, y).typ = STONE;
    vision_reset_new_level();
    vision_recalc(0);
    await applyPetHunger(dog, game);
    assert.equal(dog.dead, true);
    assert.equal(await topline(), 'You feel sad for a moment.');
});
void test('starvation through life saving consumes the real amulet and ends the pet action', async () => {
    freshObjectRoom({ moves: 851 });
    requirePlayingGame(game);
    const dog = await pet();
    assert.ok(dog.edog);
    dog.edog.mhpmax_penalty = 20;
    const amulet = await equipMonsterObject(dog, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    const starved = await applyPetHunger(dog, game);
    assert.equal(starved, true);
    assert.equal(dog.dead, false);
    assert.ok(dog.mhp > 0);
    assert.equal(dog.edog.mhpmax_penalty, 0);
    assert.equal(amulet.where, 'gone');
    assert.ok(game.level.monsters.includes(dog));
});
void test('hunger weakness commits before its message waits and interrupts ongoing work afterwards', async () => {
    freshObjectRoom({ moves: 601 });
    const dog = await pet();
    const input = resetInputState();
    input.feed('5s');
    await rhack(0);
    assert.ok(game._occupation);
    await plineWithContinuation('The earlier warning fills the message line while you continue searching.');
    const action = applyPetHunger(dog, game);
    await input.waitUntilBlocked();
    assert.equal(dog.mhpmax, 9);
    assert.ok(game._occupation);
    await answerPrompts(action, input, [
        { prompt: /earlier warning.*--More--/s, keys: ' ' },
    ]);
    assert.equal(game._occupation, null);
    assert.match(await topline(), /is confused from hunger\.  You stop searching\./);
});
//# sourceMappingURL=pet_hunger.test.js.map