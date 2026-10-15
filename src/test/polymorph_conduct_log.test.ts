import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { gameLogEvents } from '../js/gamelog.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the chronicle records the first monster transformation once', async () => {
    freshObjectRoom({ flags: { debug: true } });
    pushKeys('polyself\nnewt\n                        ');
    await rhack('#'.charCodeAt(0));
    resetInputState();
    pushKeys('polyself\ngoblin\n                        ');

    await rhack('#'.charCodeAt(0));

    const changes = gameLogEvents().filter(entry => entry.text.includes('changed form for the first time'));
    assert.equal(changes.length, 1);
    assert.match(changes[0]?.text ?? '', /becoming a newt$/);
});
