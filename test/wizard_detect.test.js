import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { CORR, SCORR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const extended of [false, true]) {
    void test(`${extended ? '#wizdetect' : 'Ctrl-E'} reveals a nearby secret corridor without taking time`, async () => {
        const level = freshGameplayRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        level.requireAt(12, 10).typ = SCORR;
        if (extended)
            await runExtendedCommand('wizdetect');
        else
            await rhack(5);
        assert.equal(level.requireAt(12, 10).typ, CORR);
        assert.match(game._pending_message, /You reveal a secret corridor!/);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=wizard_detect.test.js.map