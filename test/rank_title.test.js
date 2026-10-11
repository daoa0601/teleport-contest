import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { _statusLine1 } from '../js/display.js';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
// C botl.c:rank() via role.c rank tables and wizcmds.c:wiz_level_change().
// The status title follows the hero's experience level through the role's
// nine-entry rank table after #levelchange, in both directions.
for (const [role, target, expected] of [
    ['caveman', 10, 'Vagrant'],
    ['tourist', 7, 'Excursionist'],
    ['caveman', 30, 'Pioneer'],
]) {
    void test(`a raised ${role} hero is titled ${expected}`, async () => {
        freshObjectRoom({ role, flags: { debug: true }, hero: { ulevel: 1 } });
        requireFixtureGame(game);
        initRng(1n);
        await runExtendedCommand('levelchange', `${target}\n` + ' '.repeat(60));
        assert.equal(game.u.ulevel, target);
        assert.match(_statusLine1(), new RegExp(`the ${expected}(?:\\x1b\\[\\d+C| )`));
    });
}
void test('a drained hero returns to the starting rank title', async () => {
    freshObjectRoom({ role: 'caveman', flags: { debug: true }, hero: { ulevel: 4 } });
    requireFixtureGame(game);
    initRng(1n);
    await runExtendedCommand('levelchange', `2\n` + ' '.repeat(60));
    assert.equal(game.u.ulevel, 2);
    assert.match(_statusLine1(), /the Troglodyte(?:\x1b\[\d+C| )/);
});
void test('crossing a rank boundary reports the attained rank', async () => {
    freshObjectRoom({ role: 'caveman', flags: { debug: true }, hero: { ulevel: 1 } });
    requireFixtureGame(game);
    initRng(1n);
    await runExtendedCommand('levelchange', `10\n` + ' '.repeat(60));
    const log = gameLogEvents().map(event => event.text);
    assert.ok(log.includes('attained the rank of Vagrant (level 10)'));
});
//# sourceMappingURL=rank_title.test.js.map