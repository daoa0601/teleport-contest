import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const turns of [5, 3, 1]) {
    void test(`temporary wall passage gives its ${turns}-turn warning or recovery`, async () => {
        const input = freshTurnRoom();
        setPropertyTimeout('passesWalls', turns);
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
        input.feed('ll');
        await moveloop_core();
        await moveloop_core();
        const expected = turns === 5 ? /You start to feel bloated\./
            : turns === 3 ? /You are feeling rather flabby\./
                : /You're back to your normal self again\./;
        assert.match(messages.join('\n'), expected);
    });
}
void test('permanent wall passage suppresses its temporary warning', async () => {
    const input = freshTurnRoom();
    grantIntrinsicProperty('passesWalls', 'outside');
    setPropertyTimeout('passesWalls', 3);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.doesNotMatch(messages.join('\n'), /flabby/);
});
void test('temporary breathing warns while the hero remains in a gas region', async () => {
    const input = freshTurnRoom();
    createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]);
    setPropertyTimeout('magicalBreathing', 5);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.match(messages.join('\n'), /You seem to have some trouble breathing\./);
});
//# sourceMappingURL=timeout_warnings.test.js.map