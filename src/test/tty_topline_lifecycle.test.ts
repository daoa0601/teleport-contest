import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame } from '../js/gstate.js';
import { requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { docrt, flushPendingTopline, flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { promptKey, readDirectionKey } from '../js/tty_prompts.js';
import { DART } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function topline() {
    const row = requireScreenRow(0);
    assert.ok(row);
    return row.map(cell => cell.ch).join('').trimEnd();
}

void test('an answered prompt stays visible but a native redraw does not page it again', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    const answer = promptKey('In what direction? ');
    await input.waitUntilBlocked();
    assert.equal(topline(), 'In what direction?');

    input.feed('l');
    assert.equal(await answer, 'l'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(topline(), 'In what direction?');
    const result = await Promise.race([
        docrt().then(() => 'redrawn'),
        input.waitUntilBlocked().then(() => 'paged'),
    ]);

    assert.equal(result, 'redrawn');
    await flush_screen(1);
    assert.equal(topline(), '');
});

void test('successive key reads acknowledge each message without joining later prose to seen text', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await pline('A bell rings nearby.');
    await flush_screen(1);
    const first = nhgetch();
    await input.waitUntilBlocked();
    input.feed('x');
    await first;

    await plineWithContinuation('A door opens.');
    await flush_screen(1);
    assert.equal(topline(), 'A door opens.');
    const second = nhgetch();
    await input.waitUntilBlocked();
    input.feed('y');
    await second;
    await flush_screen(1);
    assert.equal(topline(), 'A door opens.');
    assert.equal(await flushPendingTopline(), null);
});

void test('an unread message still waits for a valid pager acknowledgment', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await pline('A bell rings nearby.');
    const pager = flushPendingTopline();
    await input.waitUntilBlocked();
    assert.equal(topline(), 'A bell rings nearby.--More--');
    input.feed('x');
    await input.waitUntilBlocked();
    assert.equal(topline(), 'A bell rings nearby.--More--');
    input.feed(' ');
    await pager;
    assert.equal(input.isBlocked, false);
});

void test('dismissing invalid throw-direction help returns without paging the answered query', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    input.feed(`${dart.invlet}+`);
    const action = rhack('t'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(topline(), 'cmdassist: Invalid direction key!');

    input.feed('\x1b');
    const result = await Promise.race([
        action.then(() => 'cancelled'),
        input.waitUntilBlocked().then(() => 'extra pager'),
    ]);

    assert.equal(result, 'cancelled');
    assert.equal(topline(), '');
    assert.ok(game.inventory.includes(dart));
    assert.equal(game.context.move, 0);
});

for (const key of ['h', '\x1b', '+']) {
    void test(`a direction query clears its message window before returning ${JSON.stringify(key)}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const input = resetInputState();
        const answer = readDirectionKey();
        await input.waitUntilBlocked();
        assert.equal(topline(), 'In what direction?');

        input.feed(key);
        assert.equal(await answer, key.charCodeAt(0));

        assert.equal(topline(), '');
        await flush_screen(1);
        assert.equal(topline(), '');
        assert.equal(await flushPendingTopline(), null);
    });
}

void test('a successful ordinary throw leaves no answered direction query on the screen', async () => {
    freshObjectRoom({ left: 1, right: 30 });
    requirePlayingGame(game);
    const dart = await addInventoryObject(DART);
    const input = resetInputState();
    input.feed(`${dart.invlet}h`);

    await rhack('t'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(topline(), '');
    assert.equal(game.context.move, 1);
    assert.equal(dart.where, 'floor');
});
