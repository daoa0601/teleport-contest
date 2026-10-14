import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('ordinary farlook offers information about the hero and keeps looking after declining it', async () => {
    freshObjectRoom({ role: 'wizard', flags: { tips: false, verbose: true, help: true } });
    game.plname = 'Aster';
    newsym(game.u.ux, game.u.uy);
    const input = resetInputState();
    input.feed('/');
    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /Please move the cursor.*--More--/, keys: ' ' },
        { prompt: /For instructions/, keys: '.' },
        { prompt: /human wizard called Aster\).*--More--/, keys: ' ' },
        { prompt: /More info about "human wizard"\?/, keys: 'n' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=farlook_lookup.test.js.map