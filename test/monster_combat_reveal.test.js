import test from 'node:test';
import assert from 'node:assert/strict';
import { M_AP_MONSTER, M_AP_TYPE, NO_MINVENT } from '../js/const.js';
import { canSeeMonster, clearMessageWindow, flush_screen, glyphAt, moreUntilDismissed, newsym, plineWithContinuation, } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS, AT_BITE, AT_CLAW } from '../js/monster_attack_types.js';
import { canSeeMonsterCombat, prepareMonsterCombatContact, revealMonsterCombatDefender, showMonsterCombatMiss, } from '../js/monster_combat_messages.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { beginMonsterMealMimicry } from '../js/monster_meal_mimicry.js';
import { APPLE } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function topline() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
async function hiddenSnake(x = 12) {
    const snake = await createMonsterAt('garter snake', x, 10, NO_MINVENT);
    snake.minvis = true;
    await floorObject(APPLE, x, 10);
    assert.equal(await hideMonsterUnder(snake), true);
    snake.minvis = false;
    newsym(x, 10);
    return snake;
}
void test('attacking an unnoticed concealed defender reveals it with an indefinite name', async () => {
    freshObjectRoom();
    const snake = await hiddenSnake();
    assert.equal(glyphAt(12, 10)?.kind, 'object');
    await revealMonsterCombatDefender(snake);
    assert.equal(await topline(), 'Suddenly, you notice a garter snake.');
    assert.equal(canSeeMonster(snake), true);
    assert.equal(glyphAt(12, 10)?.kind, 'monster');
});
void test('a defender seen hiding immediately emerges from hiding before combat', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const snake = await createMonsterAt('garter snake', 12, 10, NO_MINVENT);
    await floorObject(APPLE, 12, 10);
    assert.equal(await hideMonsterUnder(snake), true);
    const revealing = revealMonsterCombatDefender(snake);
    await input.waitUntilBlocked();
    assert.equal(glyphAt(12, 10)?.kind, 'monster', 'admission reveals the defender before its message waits');
    const visible = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(visible, /You see the garter snake slither under an apple\..*--More--/);
    input.feed(' ');
    await revealing;
    assert.equal(await topline(), 'The garter snake emerges from hiding.');
});
void test('an intervening message changes recent-hider revelation to a simple notice', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const snake = await createMonsterAt('garter snake', 12, 10, NO_MINVENT);
    await floorObject(APPLE, 12, 10);
    await hideMonsterUnder(snake);
    await answerPrompts(plineWithContinuation('You hear distant water dripping.'), input, [{
            prompt: /You see the garter snake slither under an apple\..*--More--/s,
            keys: ' ',
        }]);
    await revealMonsterCombatDefender(snake);
    assert.equal(await topline(), 'You hear distant water dripping.  You notice the garter snake.');
});
void test('an unaware hero dreams about the species rather than the hidden pet name', async () => {
    freshObjectRoom();
    const snake = await hiddenSnake();
    initializePet(snake);
    setMonsterGivenName(snake, 'Ribbon');
    putHeroToSleep(5);
    await revealMonsterCombatDefender(snake);
    assert.equal(await topline(), 'You dream of garter snakes.');
    assert.equal(canSeeMonster(snake), true);
});
void test('sensing a concealed defender suppresses its surprise message without leaving it hidden', async () => {
    freshObjectRoom();
    const snake = await hiddenSnake();
    grantIntrinsicProperty('detectMonsters', 'outside');
    await revealMonsterCombatDefender(snake);
    assert.equal(await topline(), '');
    assert.equal(canSeeMonster(snake), true);
});
void test('combat feedback reveals both concealed actors while keeping admission visibility fixed', async () => {
    freshObjectRoom({ moves: 100 });
    const attacker = await hiddenSnake(12);
    const defender = await hiddenSnake(13);
    const visible = canSeeMonsterCombat(attacker, defender);
    assert.equal(visible, false);
    await showMonsterCombatMiss(attacker, defender, [AT_BITE, AD_PHYS, 1, 4], { visible });
    assert.equal(canSeeMonsterCombat(attacker, defender), true);
    assert.equal(await topline(), 'You hear some noises.');
    assert.equal(!!attacker.mundetected, false);
    assert.equal(!!defender.mundetected, false);
});
void test('a missed attack reveals an ordinary mimic appearance before naming it', async () => {
    freshObjectRoom();
    await floorObject(APPLE, 13, 10);
    const mimic = await createMonsterAt('small mimic', 13, 10, NO_MINVENT);
    const attacker = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    assert.notEqual(M_AP_TYPE(mimic), 0);
    const visible = canSeeMonsterCombat(attacker, mimic);
    assert.equal(visible, true);
    await showMonsterCombatMiss(attacker, mimic, [AT_CLAW, AD_PHYS, 1, 4], { visible });
    assert.equal(M_AP_TYPE(mimic), 0);
    assert.equal(await topline(), 'The goblin misses the small mimic.');
    assert.equal(glyphAt(13, 10)?.kind, 'monster');
});
void test('combat reveals a borrowed monster appearance even after Escape suppresses messages', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const dog = await createMonsterAt('little dog', 13, 10, NO_MINVENT);
    initializePet(dog);
    dog.meating = 4;
    newsym(dog.mx, dog.my);
    initRng(1n);
    await answerPrompts(beginMonsterMealMimicry(dog), input, [{
            prompt: /You see a kitten appear where your little dog was!.*--More--/s,
            keys: ' ',
        }]);
    assert.equal(M_AP_TYPE(dog), M_AP_MONSTER);
    const attacker = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    await answerPrompts(moreUntilDismissed('You wait for something to happen.'), input, [{
            prompt: /You wait for something to happen\..*--More--/s, keys: 27,
        }]);
    clearMessageWindow();
    const visible = canSeeMonsterCombat(attacker, dog);
    await prepareMonsterCombatContact(attacker, dog, [AT_CLAW, AD_PHYS, 1, 4], null, { visible });
    assert.equal(M_AP_TYPE(dog), 0);
    const displayedDog = glyphAt(13, 10);
    assert.equal(displayedDog?.kind, 'monster');
    assert.equal(displayedDog?.mnum, dog.mnum);
    assert.equal(await topline(), '');
});
void test('a visible attack marks a still-unseen participant on the map', async () => {
    freshObjectRoom();
    const attacker = await createMonsterAt('goblin', 12, 10, NO_MINVENT);
    const defender = await createMonsterAt('jackal', 13, 10, NO_MINVENT);
    defender.minvis = true;
    const visible = canSeeMonsterCombat(attacker, defender);
    assert.equal(visible, true);
    await prepareMonsterCombatContact(attacker, defender, [AT_CLAW, AD_PHYS, 1, 4], null, { visible });
    assert.equal(await topline(), 'The goblin hits it.');
    assert.equal(glyphAt(13, 10)?.kind, 'invisible');
});
//# sourceMappingURL=monster_combat_reveal.test.js.map