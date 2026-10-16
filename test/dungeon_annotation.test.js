import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { planInput } from './support/planned-input.js';
void test('annotating an already named level asks to replace the abbreviated annotation', async (t) => {
    freshConnectedLevels();
    game._levelAnnotations = new Map([['0:1', 'A long annotation with more than thirty characters']]);
    const input = resetInputState();
    input.feed('annotate\r');
    planInput(input, t, [{ prompt: /Replace annotation "A long annotation with more th\.\.\." with\?/, keys: '  New   name  \r' }]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._levelAnnotations.get('0:1'), 'New name');
    assert.equal(game.context.move, 0);
});
void test('level annotations accept printable characters beyond ASCII', async () => {
    freshConnectedLevels();
    const input = resetInputState();
    input.feed('annotate\rCafé\r');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._levelAnnotations?.get('0:1'), 'Café');
});
void test('annotation cleanup preserves nonbreaking spaces', async () => {
    freshConnectedLevels();
    const input = resetInputState();
    input.feed('annotate\r  A\u00a0B  \r');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._levelAnnotations?.get('0:1'), 'A\u00a0B');
});
for (const command of ['m#annotate\r', 'm\x0f']) {
    void test(`${command.includes('#') ? 'menu annotate' : 'menu overview'} can name a different visited level`, async (t) => {
        freshConnectedLevels();
        requirePlayingGame(game);
        game.flags.verbose = false;
        await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
        const input = resetInputState();
        input.feed(command);
        planInput(input, t, [
            { prompt: /a - Level 1:/, keys: 'a' },
            { prompt: /What do you want to call level 1\?/, keys: 'The entry\r' },
        ]);
        await rhack(0);
        assert.equal(game._levelAnnotations?.get('0:1'), 'The entry');
        assert.equal(game.u.uz.dlevel, 2);
        assert.equal(game.iflags.menu_requested, false);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=dungeon_annotation.test.js.map