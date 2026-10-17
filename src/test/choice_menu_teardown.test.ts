import assert from 'node:assert/strict';
import test from 'node:test';
import { docrt, flush_screen, plineWithContinuation } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showChoiceWindow } from '../js/windows.js';
import { freshGameplayRoom } from './support/playable-room.js';

for (const answer of ['a', ':']) {
    void test(`a choice menu erases its overlay after ${answer === ':' ? 'a colon selection' : 'a selection'}`, async () => {
        freshGameplayRoom();
        await docrt();
        await flush_screen(1);
        const input = resetInputState();
        input.feed(answer);

        const selected = await showChoiceWindow({
            title: 'Choose an action:',
            entries: [{ key: 'a', text: 'inspect the chest' }, { key: ':', text: 'look inside' }],
        });

        assert.equal(selected, answer.charCodeAt(0));
        const text = requireGameDisplay().grid
            .map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.doesNotMatch(text, /Choose an action|inspect the chest|\(end\)/);
        assert.match(text, /@/);
    });
}

for (const overlay of [true, false]) {
    void test(`dismissing a ${overlay ? 'corner' : 'full-screen'} choice menu leaves the previous message erased`, async () => {
        freshGameplayRoom({ flags: { menu_overlay: overlay } });
        await docrt();
        await flush_screen(1);
        await plineWithContinuation('You hear footsteps.');
        await flush_screen(1);
        const input = resetInputState();
        const choice = showChoiceWindow({
            title: 'Choose an action:',
            entries: [{ key: 'a', text: 'inspect the chest' }],
        });

        const display = requireGameDisplay();
        try {
            await input.waitUntilBlocked();
            assert.equal(display.grid[0]?.map(cell => cell.ch).join('').trim(),
                'You hear footsteps.--More--');
            input.feed('a');
            await input.waitUntilBlocked();
            assert.equal(display.grid[0]?.map(cell => cell.ch).join('').trim(),
                'You hear footsteps.--More--', 'A menu selector cannot acknowledge unread prose');
        } finally {
            input.feed(' a');
            await choice;
        }

        assert.equal(await choice, 'a'.charCodeAt(0));
        assert.equal(display.grid[0]?.map(cell => cell.ch).join('').trim(), '');
        await plineWithContinuation('The corridor is quiet.');
        await flush_screen(1);
        assert.equal(display.grid[0]?.map(cell => cell.ch).join('').trim(), 'The corridor is quiet.');
    });
}
