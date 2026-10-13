import assert from 'node:assert/strict';
import test from 'node:test';
import { PICK_NONE, PICK_ONE } from '../js/const.js';
import { bot, docrt, flush_screen, plineWithContinuation, showMessageMenu, } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
function rowText(row) {
    return requireScreenRow(row).map(cell => cell.ch).join('').trimEnd();
}
void test('a singleton message menu selects its letter and clears the answered topline', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, 'b - an uncursed dagger.'), input, [{ prompt: /b - an uncursed dagger\.--More--/, keys: 'b' }]);
    assert.equal(selected, 'b'.charCodeAt(0));
    assert.equal(rowText(0), '');
    assert.equal(requireGameDisplay().cursorRow, 0);
    assert.equal(requireGameDisplay().cursorCol, 0);
});
void test('a singleton ignores other letters and digits without accepting a count', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, 'b - 7 uncursed daggers.'), input, [
        { prompt: /b - 7 uncursed daggers\.--More--/, keys: 'x' },
        { prompt: /b - 7 uncursed daggers\.--More--/, keys: '2' },
        { prompt: /b - 7 uncursed daggers\.--More--/, keys: 'B' },
        { prompt: /b - 7 uncursed daggers\.--More--/, keys: 'b' },
    ]);
    assert.equal(selected, 'b'.charCodeAt(0));
    assert.equal(rowText(0), '');
});
for (const { name, key } of [
    { name: 'Space', key: ' ' },
    { name: 'Enter', key: '\n' },
    { name: 'Return', key: '\r' },
]) {
    void test(`${name} dismisses a singleton without selecting the item`, async () => {
        freshObjectRoom();
        const input = resetInputState();
        const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, 'b - an uncursed dagger.'), input, [{ prompt: /b - an uncursed dagger\.--More--/, keys: key }]);
        assert.equal(selected, 0);
        assert.equal(rowText(0), '');
    });
}
void test('Escape cancels a singleton without suppressing subsequent ordinary messages', async () => {
    freshObjectRoom();
    const input = resetInputState();
    const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, 'b - an uncursed dagger.'), input, [{ prompt: /b - an uncursed dagger\.--More--/, keys: '\x1b' }]);
    assert.equal(selected, 27);
    assert.equal(rowText(0), '');
    await plineWithContinuation('You keep your dagger.');
    await flush_screen(1);
    assert.equal(rowText(0), 'You keep your dagger.');
});
void test('a wrapped singleton pages once and restores the map it covered', async () => {
    freshObjectRoom({ top: 0, bottom: 4, heroY: 1 });
    requirePlayingGame(game);
    await docrt();
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '@');
    const input = resetInputState();
    const message = 'b - an uncursed dagger named '
        + 'a keepsake from the long journey through the mountains '.repeat(4);
    const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, message), input, [{ prompt: /mountains\s*--More--/, keys: 'b' }]);
    assert.equal(selected, 'b'.charCodeAt(0));
    assert.equal(rowText(0), '');
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '@');
    assert.equal(requireGameDisplay().cursorRow, 0);
    assert.equal(requireGameDisplay().cursorCol, 0);
    const screen = requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.doesNotMatch(screen, /--More--/);
});
void test('a singleton restores a map row used only by its More marker', async () => {
    freshObjectRoom({ top: 0, bottom: 4, heroY: 0 });
    requirePlayingGame(game);
    await docrt();
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, 1).ch, '@');
    const input = resetInputState();
    const selected = await answerPrompts(showMessageMenu('b', PICK_ONE, 'b - a dagger.'.padEnd(72, '.')), input, [{ prompt: /\n--More--/, keys: 'b' }]);
    assert.equal(selected, 'b'.charCodeAt(0));
    assert.equal(rowText(0), '');
    assert.equal(requireScreenCell(game.u.ux - 1, 1).ch, '@');
});
void test('a selectable singleton leaves status unchanged until the normal status update', async () => {
    freshObjectRoom({ hero: { uhp: 12, uhpmax: 20 } });
    requirePlayingGame(game);
    await bot();
    await loseHeroHp(5, 'a blow');
    const input = resetInputState();
    const selection = showMessageMenu('b', PICK_ONE, 'b - an uncursed dagger.');
    try {
        await input.waitUntilBlocked();
        assert.match(rowText(23), /HP:12\(20\)/);
    }
    finally {
        input.feed('b');
        await selection;
    }
    assert.match(rowText(23), /HP:12\(20\)/);
    await bot();
    assert.match(rowText(23), /HP:7\(20\)/);
});
void test('a nonselectable singleton is ordinary prose without a forced More prompt', async () => {
    freshObjectRoom({ hero: { uhp: 12, uhpmax: 20 } });
    requirePlayingGame(game);
    await bot();
    await loseHeroHp(5, 'a blow');
    const input = resetInputState();
    const selected = await answerPrompts(showMessageMenu('b', PICK_NONE, 'b - an uncursed dagger.'), input, []);
    assert.equal(selected, 0);
    assert.match(rowText(23), /HP:7\(20\)/);
    await flush_screen(1);
    assert.equal(rowText(0), 'b - an uncursed dagger.');
});
//# sourceMappingURL=message_menu.test.js.map