import { installPagerInput } from './support/pager-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { damageHeroFromMonster } from '../js/hero_damage.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';

async function damageRoom() {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    const messages: string[] = [];
    installPagerInput(input, { expected: /HP|human form|kobold|body|creature|monster/i, limit: 16 });
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    const monster = await createMonsterAt('ice vortex', 11, 10);
    return { monster, messages };
}

void test('monster damage reports the subtraction before clamping to a reduced HP maximum', async () => {
    const { monster, messages } = await damageRoom();
    requirePlayingGame(game);
    game.flags.showdamage = true;
    game.u.uhp = 20;
    game.u.uhpmax = 10;

    assert.equal(await damageHeroFromMonster(monster, 3), false);
    await flushPendingTopline();

    assert.equal(game.u.uhp, 10);
    assert.equal(game.u.uhpmax, 10);
    assert.match(messages.join('\n'), /\[HP -3, 17 left\]/);
});

void test('a zero-damage monster effect still clamps current HP without a damage message', async () => {
    const { monster, messages } = await damageRoom();
    requirePlayingGame(game);
    game.flags.showdamage = true;
    game.u.uhp = 20;
    game.u.uhpmax = 10;

    await damageHeroFromMonster(monster, 0);
    await flushPendingTopline();

    assert.equal(game.u.uhp, 10);
    assert.doesNotMatch(messages.join('\n'), /\[HP/);
});

void test('monster damage exhausts the borrowed body before hurting the original body', async () => {
    const { monster, messages } = await damageRoom();
    requirePlayingGame(game);
    game.flags.debug = true;
    await runExtendedCommand('polyself', 'kobold\n');
    assert.equal(MONSTER_NAME[game.u.umonnum], 'kobold');
    const humanHP = game.u.uhp;

    assert.equal(await damageHeroFromMonster(monster, game.u.mh + 1), false);
    await flushPendingTopline();

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, humanHP);
    assert.match(messages.join('\n'), /You return to human form!/);
    assert.notEqual(game.program_state.gameover, true);
});
