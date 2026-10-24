import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT, POOL } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { TOWEL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenCell } from './support/screen.js';
import { syncBlindness } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
void test('a concealed attacker reveals itself and the object covering it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const snake = await createMonsterAt('pit viper', 11, 10, NO_MINVENT);
    await floorObject(TOWEL, 11, 10, { bknown: false });
    snake.minvis = true;
    assert.equal(await hideMonsterUnder(snake), true);
    snake.minvis = false;
    snake.mpeaceful = 0;
    snake.mux = game.u.ux;
    snake.muy = game.u.uy;
    const input = resetInputState();
    const attack = performMonsterHeroAttack(snake, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 0,
    });
    await input.waitUntilBlocked();
    const reveal = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    input.feed(' ');
    installPagerInput(input, { expected: /pit viper/, limit: 5 });
    await attack;
    assert.match(reveal, /^A pit viper was hidden under a towel!/);
    assert.equal(snake.mundetected, 0);
});
for (const underwater of [false, true]) {
    void test(`an attacker reveals ${underwater ? 'its covering object to an underwater hero' : 'the water without identifying the submerged object'}`, async () => {
        const level = freshObjectRoom({ hero: { underwater } });
        requirePlayingGame(game);
        if (underwater)
            level.requireAt(10, 10).typ = POOL;
        level.requireAt(11, 10).typ = POOL;
        const eel = await createMonsterAt('giant eel', 11, 10, NO_MINVENT);
        const towel = await floorObject(TOWEL, 11, 10, { dknown: false, bknown: false });
        eel.mundetected = 1;
        eel.mpeaceful = 0;
        eel.mux = game.u.ux;
        eel.muy = game.u.uy;
        const input = resetInputState();
        const attack = performMonsterHeroAttack(eel, game, {
            random: () => 0, rollOne: () => 1, rollDice: () => 0,
        });
        await input.waitUntilBlocked();
        const reveal = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        input.feed(' ');
        installPagerInput(input, { expected: /giant eel|Something/, limit: 5 });
        await attack;
        assert.match(reveal, underwater ? /was hidden under a towel!/ : /was hidden under the water!/);
        assert.equal(towel.dknown, underwater, 'appearance is learned only when the object is named');
        assert.equal(eel.mundetected, 0);
    });
}
void test('a blind warned hero sees the warning, not a remembered unseen marker, where a hidden jellyfish stung', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 20, warning: true } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('jellyfish', 11, 10, NO_MINVENT);
    eel.mundetected = 1;
    eel.mpeaceful = 0;
    eel.mux = game.u.ux;
    eel.muy = game.u.uy;
    syncBlindness(game);
    vision_recalc(0);
    const input = resetInputState();
    installPagerInput(input, { expected: /It /, limit: 5 });
    await performMonsterHeroAttack(eel, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 0,
    });
    await flush_screen(1);
    assert.equal(eel.mundetected, 0);
    assert.match(requireScreenCell(10, 11).ch, /^[1-5]$/);
});
void test('an invisible attacking eel is revealed where the hero sees its pool', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('giant eel', 11, 10, NO_MINVENT);
    eel.minvis = true;
    eel.mundetected = 0;
    eel.mpeaceful = 0;
    eel.mux = game.u.ux;
    eel.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /giant eel|Something|It |hit|wrap|swing/i, limit: 5 });
    await performMonsterHeroAttack(eel, game, {
        random: () => 0, rollOne: () => 1, rollDice: () => 0,
    });
    await flush_screen(1);
    assert.equal(eel.minvis, 0, 'mattacku reveals an attacking invisible eel');
    assert.equal(requireScreenCell(10, 11).ch, ';');
});
//# sourceMappingURL=hidden_attacker_message.test.js.map