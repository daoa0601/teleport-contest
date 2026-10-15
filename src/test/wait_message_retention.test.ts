import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { TOWEL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('repeated waiting keeps an unacknowledged level sound visible', async () => {
    const input = freshTurnRoom();
    input.feed('4.');
    await rhack(0);
    await plineWithContinuation('You hear the tones of courtly conversation.');

    await continueCountedCommand();
    await flush_screen();

    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(topline, 'You hear the tones of courtly conversation.');
    assert.equal(game.context.move, 1, 'the repeated wait still takes time');
});

void test('a concealed attacker waits for a level sound to be acknowledged before dealing damage', async () => {
    const input = freshTurnRoom({ hero: { uhp: 100, uhpmax: 100 } });
    input.feed('2.');
    await rhack(0);
    await plineWithContinuation('You hear the tones of courtly conversation.');
    await continueCountedCommand();
    requirePlayingGame(game);
    const snake = await createMonsterAt('garter snake', 11, 10, NO_MINVENT);
    await floorObject(TOWEL, 11, 10, { bknown: false });
    snake.mundetected = 1;
    snake.mpeaceful = 0;
    snake.mux = game.u.ux;
    snake.muy = game.u.uy;
    snake.m_lev = 100;
    const hp = game.u.uhp;

    const attack = performMonsterHeroAttack(snake, game);
    try {
        const boundary = await Promise.race([
            input.waitUntilBlocked().then(() => 'waiting'), attack.then(() => 'finished'),
        ]);
        assert.equal(boundary, 'waiting', 'the hidden attack must wait for acknowledgment');
        const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
        assert.equal(topline, 'You hear the tones of courtly conversation.--More--');
        assert.equal(game.u.uhp, hp, 'the concealed hit cannot deal damage before the older message is dismissed');
    } finally {
        input.feed(' ');
        installPagerInput(input, { expected: /garter snake/, limit: 4 });
        await attack;
    }
    assert.ok(game.u.uhp < hp, 'the acknowledged attack resumes and damages the hero');
});
