import assert from 'node:assert/strict';
import test from 'node:test';

import { finishOrdinaryDeath } from '../js/end.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CORPSE, DAGGER } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function visibleText(): string {
    return requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

void test('acknowledges the death message before leaving bones when disclosure is disabled', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    init_objects();
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    game.flags.tombstone = false;
    game.flags.debug = true;
    game.dungeons = [createDungeon({
        dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D',
    })];
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await plineWithContinuation('You die...', { urgent: true });

    const ending = finishOrdinaryDeath({ killer: 'a falling rock' });
    await input.waitUntilBlocked();

    assert.match(visibleText(), /You die\.\.\.--More--/);
    assert.equal(game.inventory.includes(dagger), true);
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)
        .some(object => object.otyp === CORPSE), false);
    input.feed(' ');
    await input.waitUntilBlocked();

    assert.match(visibleText(), /Save bones\?/);
    input.feed('y');
    await input.waitUntilBlocked();

    assert.match(visibleText(), /You were level/);
    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(floorObjectsAt(level, game.u.ux, game.u.uy)
        .some(object => object.otyp === CORPSE), true);
    input.feed(' ');
    await ending;
});

void test('ending text does not reprompt a message after Escape cancels the message window', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    game.flags.disclose = '-i -a -v -c -o';
    game.flags.tombstone = false;
    const input = resetInputState();
    await plineWithContinuation('The ceiling cracks and great clouds of dust fill the entire room.');
    const warning = plineWithContinuation('You are crushed beneath a falling boulder.');
    await input.waitUntilBlocked();
    assert.match(visibleText(), /The ceiling cracks.*--More--/);
    input.feed('\x1b');
    await warning;

    const ending = finishOrdinaryDeath({ killer: 'a falling boulder' });
    await input.waitUntilBlocked();

    assert.match(visibleText(), /You were level/);
    assert.doesNotMatch(visibleText(), /You are crushed/);
    input.feed(' ');
    await ending;
});

for (const { name, tombstone, dismissal, trailingPage } of [
    { name: 'keeps the native trailing blank after a full tombstone page', tombstone: true, dismissal: ' ', trailingPage: true },
    { name: 'cancels the remaining death text after Escape', tombstone: true, dismissal: '\x1b', trailingPage: false },
    { name: 'does not invent a trailing page without the tombstone', tombstone: false, dismissal: ' ', trailingPage: false },
]) {
    void test(name, async () => {
        freshPlayableRoom();
        requirePlayingGame(game);
        game.flags.disclose = '-i -a -v -c -o';
        game.flags.tombstone = tombstone;
        game.iflags.toptenwin = false;
        const input = resetInputState();
        const ending = finishOrdinaryDeath({ killer: 'a falling rock' });

        await input.waitUntilBlocked();
        const summary = visibleText();
        assert.match(summary, /You were level/);
        assert.equal(summary.includes('REST'), tombstone);
        assert.match(summary, /--More--/);
        input.feed(dismissal);

        const hasNextPage = await Promise.race([
            input.waitUntilBlocked().then(() => true),
            ending.then(() => false),
        ]);
        assert.equal(hasNextPage, trailingPage,
            `Unexpected remaining death text: ${visibleText()}`);
        if (trailingPage) {
            assert.equal(visibleText().trim(), '--More--');
            assert.equal(requireGameDisplay().cursorRow, requireGameDisplay().rows - 1);
            input.feed(' ');
        }
        await ending;
    });
}
