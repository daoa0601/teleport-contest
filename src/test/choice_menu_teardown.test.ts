import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showChoiceWindow } from '../js/windows.js';
import { freshGameplayRoom } from './support/playable-room.js';

for (const answer of ['a', ':']) {
    void test(`a choice menu erases its overlay after ${answer === ':' ? 'a hidden command' : 'a selection'}`, async () => {
        freshGameplayRoom();
        await docrt();
        await flush_screen(1);
        const input = resetInputState();
        input.feed(answer);

        const selected = await showChoiceWindow({
            title: 'Choose an action:',
            entries: [{ key: 'a', text: 'inspect the chest' }],
            validKeys: ['a'.charCodeAt(0), ':'.charCodeAt(0)],
        });

        assert.equal(selected, answer.charCodeAt(0));
        const text = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.doesNotMatch(text, /Choose an action|inspect the chest|\(end\)/);
        assert.match(text, /@/);
    });
}
