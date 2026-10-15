import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { grantIntrinsicProperty, hasIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
for (const sight of ['sighted', 'blind', 'blind and invisible']) {
    void test(`fountain water grants permanent see-invisible to a ${sight} hero`, async () => {
        const level = freshObjectRoom({ hero: { blindTurns: sight === 'sighted' ? 0 : 30 } });
        level.requireAt(10, 10).typ = FOUNTAIN;
        if (sight === 'blind and invisible')
            grantIntrinsicProperty('invisible', 'outside');
        resetInputState().feed('y' + ' '.repeat(10));
        initRng(10n);
        await rhack('q'.charCodeAt(0));
        assert.equal(hasIntrinsicProperty('seeInvisible', 'outside'), true);
        const message = sight === 'sighted' ? /image of someone stalking you/
            : sight === 'blind' ? /very self-conscious/ : /feel transparent/;
        assert.match(game._pending_message, message);
    });
}
void test('fountain monster detection describes the taste when there are no monsters', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed('y' + ' '.repeat(10));
    initRng(7n);
    await rhack('q'.charCodeAt(0));
    assert.match([...messages, game._pending_message].join('\n'), /The water tastes like nothing\./);
});
//# sourceMappingURL=fountain_drink_seeing.test.js.map