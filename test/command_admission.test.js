import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { SCORR, CORR } from '../js/const.js';
import { startLuaCore } from './support/lua-game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const keys of ['\x06', '#wizmap\n', '!', 'm\x06', 'F\x06']) {
    void test(`wizard command admission rejects ${JSON.stringify(keys)} in normal play`, async () => {
        const level = freshGameplayRoom();
        requirePlayingGame(game);
        level.requireAt(30, 10).typ = SCORR;
        applyNethackrc('BIND=!:wizmap');
        pushKeys(keys);
        await rhack(0);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, keys === '#wizmap\n'
            ? '#wizmap: unknown extended command.' : "Unavailable command 'wizmap'.");
        assert.equal(level.requireAt(30, 10).typ, SCORR);
    });
}
void test('wizard command admission permits the command in wizard mode', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(30, 10).typ = SCORR;
    applyNethackrc('OPTIONS=playmode:debug\nBIND=!:wizmap');
    pushKeys('!');
    await rhack(0);
    assert.equal(game.context.move, 0);
    assert.equal(level.requireAt(30, 10).typ, CORR);
});
for (const keys of ['\x06', '#wizmap\n', 'F\x06']) {
    void test(`Lua can silently veto ${JSON.stringify(keys)} before wizard-mode rejection`, async (t) => {
        const level = freshGameplayRoom();
        requirePlayingGame(game);
        level.requireAt(30, 10).typ = SCORR;
        const core = await startLuaCore(t);
        core.execute(`
            function prevent_mapping(command)
                return command ~= "wizmap"
            end
            nh.callback("cmd_before", "prevent_mapping")
        `);
        pushKeys(keys);
        await rhack(0);
        assert.equal(game.context.move, 0);
        assert.doesNotMatch(game._pending_message, /Unavailable command|prefix|unknown command/i);
        assert.equal(level.requireAt(30, 10).typ, SCORR);
    });
}
//# sourceMappingURL=command_admission.test.js.map