import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { CRYSTAL_BALL } from '../js/object_data.js';
import { finish, screen, startMenuGame, type } from './support/context-menu-game.js';
import { addInventoryObject } from './support/game-objects.js';
void test('a user-input entry at a direction prompt reports the malformed queue and cancels', async () => {
    const engine = await startMenuGame();
    try {
        const moves = game.moves;
        await type(engine, '#therecmdmenu');
        engine.inputGate.queueCommandResponses(['user-input', 'y'.charCodeAt(0)]);
        await type(engine, '\n');
        assert.match(screen(), /getdir: command queue had no dir\?/);
        assert.match(screen(), /--More--/);
        await type(engine, ' ');
        assert.match(screen(), /Program in disorder!/);
        assert.match(screen(), /--More--/);
        await type(engine, ' ');
        assert.match(screen(), /Please report these messages to devteam@nethack\.org\./);
        assert.equal(game.moves, moves);
        assert.equal(game.u.ux, 10);
        assert.equal(game.u.uy, 10);
        await type(engine, 'i');
        assert.match(screen(), /Weapons|Armor/);
    }
    finally {
        await finish(engine);
    }
});
void test('a map click cancels a crystal-ball symbol prompt as NUL', async () => {
    const engine = await startMenuGame('BINDINGS=mouse1:nothing');
    try {
        const ball = await addInventoryObject(CRYSTAL_BALL, { initialize: false, spe: 0 });
        await type(engine, 'a' + ball.invlet);
        assert.match(screen(), /You may look for an object, monster, or special map symbol\./);
        await type(engine, ' ');
        assert.match(screen(), /What do you look for\?/);
        const moves = game.moves;
        engine.inputGate.feedMapClick(12, 10, 1);
        await engine.runUntilInputNeeded();
        assert.match(screen(), /Never mind\./);
        assert.doesNotMatch(screen(), /You peer into|The vision is unclear/);
        assert.equal(game.moves, moves + 1);
        assert.equal(ball.spe, 0);
        assert.equal(game.inventory.includes(ball), true);
        await type(engine, 'i');
        assert.match(screen(), /crystal ball/);
    }
    finally {
        await finish(engine);
    }
});
void test('recalling a cancelled object question separates its prompt and answer with one space', async () => {
    const engine = await startMenuGame('OPTIONS=msg_window:single');
    try {
        await type(engine, 'd');
        assert.match(screen(), /What do you want to drop\?/);
        await type(engine, '\x1b');
        assert.match(screen(), /Never mind\./);
        await type(engine, '\x10\x10');
        const recalled = screen().split('\n')[0]?.trimEnd() ?? '';
        assert.match(recalled, /^What do you want to drop\? \[[^\]]+\] <esc>$/);
    }
    finally {
        await finish(engine);
    }
});
//# sourceMappingURL=command_prompt_input.test.js.map