// C topten.c:readentry()+topten(): the native record read stops at the first
// line that fails to parse or falls below sysopt.pointsmin, and every string
// column keeps its native width (ROLESZ, NAMSZ, DTHSZ).
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishOrdinaryQuit } from '../js/end.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { loadScoreRecords, saveScoreRecords } from '../js/score_records.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
function record(overrides) {
    return {
        name: 'Ghost', role: 'Val', race: 'Hum', gender: 'Fem', align: 'Neu',
        points: 100, deathdnum: 0, deathlev: 1, maxlvl: 1, hp: 0, maxhp: 40,
        dungeon: 'The Dungeons of Doom', outcome: 'died', death: 'died',
        ...overrides,
    };
}
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function quitWithStorage(records) {
    const storage = memoryStorage();
    freshConnectedLevels({ role: 'valkyrie' });
    requirePlayingGame(game);
    game.storage = storage;
    saveScoreRecords(records);
    game.plname = 'Ada';
    game.flags.disclose = '-i -a -v -c -o';
    game.u.urexp = 100;
    const input = resetInputState();
    const ending = finishOrdinaryQuit();
    await input.waitUntilBlocked();
    input.feed(' ');
    await ending;
    return loadScoreRecords();
}
void test('the score list read ends at the first record below pointsmin', async () => {
    const saved = await quitWithStorage([
        record({ name: 'First', points: 400 }),
        record({ name: 'Blank', points: 0 }),
        record({ name: 'Third', points: 300 }),
    ]);
    assert.deepEqual(saved.map(entry => entry.name), ['First', 'Ada']);
    const screen = visibleText();
    assert.match(screen, /You made the top ten list!/);
    assert.match(screen, /Ada-Val-Hum/);
    assert.doesNotMatch(screen, /Third/, 'entries after a sub-minimum record are never read');
});
void test('records keep native field widths when grouped and displayed', async () => {
    const saved = await quitWithStorage([
        record({ name: 'First', points: 400, role: 'ValkyrieX' }),
        record({ name: 'Second', points: 300, role: 'ValkyrieX' }),
        record({ name: 'Third', points: 200, role: 'ValkyrieX' }),
    ]);
    assert.deepEqual(saved.map(entry => entry.name), ['First', 'Second', 'Third']);
    const screen = visibleText();
    assert.match(screen, /didn't beat your previous score of 200 points/);
    assert.match(screen, /Third-Val-Hum/);
    assert.doesNotMatch(screen, /ValkyrieX/, 'the role column is read at ROLESZ width');
    assert.doesNotMatch(screen, /You made the top ten list!/);
});
//# sourceMappingURL=topten_record_read.test.js.map