import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { recordAchievement } from '../js/achievements.js';
import { ACH_SHOP, ACH_TUNE } from '../js/const.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
// C insight.c record_achievement() livelogs each new achievement, and
// show_gamelog() feeds one '%5ld: %s' line per event through the tty text
// window, whose compress_str() drops the leading padding of lines at or
// past the terminal width.  An entry over 80 columns therefore loses its
// turn-number indentation instead of being cut short.
const LONG_EVENT = 'consumed animal products for the first time, by eating a little dog corpse';
void test('a long chronicle line drops its padding instead of truncating', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.gamelog = [
        { turn: 1, text: 'entered the dungeon' },
        { turn: 32, text: 'ate for the first time - little dog corpse' },
        { turn: 32, text: LONG_EVENT },
    ];
    recordAchievement(game, ACH_SHOP);
    assert.ok(game.gamelog.some(entry => entry.text === 'entered a shop'));
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8 });
    await rhack('v'.charCodeAt(0));
    const rows = (game.nhDisplay?.grid ?? [])
        .map(row => row.map(cell => cell.ch).join('').trimEnd());
    const longRow = rows.find(row => row.startsWith('32: ' + LONG_EVENT.slice(0, 20)));
    assert.ok(longRow, `chronicle kept the long line:\n${rows.slice(0, 8).join('\n')}`);
    assert.ok(longRow.endsWith('little dog corpse'));
    assert.ok(!rows.some(row => row.startsWith('   32: consumed animal')
        && !row.endsWith('corpse')), 'the padded line must not be truncated');
});
void test('the chronicle describes learning the castle tune', async () => {
    freshTurnRoom({ hero: { uachieved: [] } });
    recordAchievement(game, ACH_TUNE);
    installPagerInput(resetInputState(), { expected: /Logged events:/, limit: 1 });
    await rhack('v'.charCodeAt(0));
    const screen = requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(screen, /learned castle drawbridge's tune/);
});
//# sourceMappingURL=chronicle_long_lines.test.js.map