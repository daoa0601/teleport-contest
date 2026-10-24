import test from 'node:test';
import assert from 'node:assert/strict';

import { restoregamePreamble } from '../js/allmain.js';
import { GameDisplay } from '../js/game_display.js';
import { flushPendingTopline } from '../js/display.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { requireScreenRow } from './support/screen.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';

// C restore.c:getlev() finishes dorecover() by running restore_cham() for
// every monster on the restored current level. A cancelled shapechanger that
// was saved in a borrowed body returns to that body's natural form across the
// round trip, exactly as it does when its level is re-entered from the cache.
void test('a cancelled shapechanger returns to its natural form across a save and restore', async () => {
    initRng(6102);
    freshObjectRoom({
        role: 'wizard',
        hero: { ualignbase: [0, 0] },
        flags: { female: false, initgend: 0 },
    });
    game.plname = game.displayName = 'Cham';
    // Detection senses the revert without restored sight, as a blind
    // telepathic hero would; C's docrt() then flushes the pending line at
    // cls()'s display_nhwindow(WIN_MESSAGE, FALSE) — one key — and the
    // greeting overwrites the top line.
    game.detectMonsters = true;
    const monster = await createMonsterAt('chameleon', 11, 10);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    monster.mcan = 1;
    const storage = memoryStorage();

    assert.equal(await saveGame(storage), true);
    resetGame();
    initRng(6102);
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Cham', storage), true);
    const level = game.level;
    assert.ok(level instanceof GameMap, 'Expected the saved level to be restored');
    const restored = level.monsters[0];
    assert.ok(restored, 'Expected the saved monster to be restored');
    assert.equal(restored.mnum, MONSTER_NAME.indexOf('little dog'));

    const input = resetInputState();
    installPagerInput(input, { expected: /turns into|welcome back/, limit: 4 });
    await restoregamePreamble();
    await flushPendingTopline();

    assert.equal(restored.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(restored.cham, -1, 'Cancellation keeps the reverted body from shapechanging again.');
    assert.equal(!!restored.mcan, true, 'Restoration keeps the monster cancelled.');
    const topline = requireScreenRow(0).map(cell => cell.ch).join('');
    assert.match(topline, /welcome back to NetHack!/);
    assert.doesNotMatch(topline, /turns into/,
        'The shape-change line is erased, not paged, before the greeting.');
});

// C's restore_cham() pass runs inside getlev() with program_state.restoring
// still set and before vision_reset() (restore.c:898-931): sensing can
// announce a revert, but plain sight sees nothing yet and no map or status
// output happens behind the message. docrt() only paints after the key that
// dismisses the line at cls()'s message flush.
void test('the restore shape pass senses only and paints nothing behind its message', async () => {
    initRng(6107);
    freshObjectRoom({
        role: 'wizard',
        hero: { ualignbase: [0, 0] },
        flags: { female: false, initgend: 0 },
    });
    game.plname = game.displayName = 'Window';
    game.detectMonsters = true;
    const monster = await createMonsterAt('chameleon', 11, 10);
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));
    monster.mcan = 1;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);

    resetGame();
    initRng(6107);
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Window', storage), true);
    const restored = game.level?.monsters[0];
    assert.ok(restored);

    const input = resetInputState();
    installPagerInput(input, { expected: /turns into|welcome back/, limit: 4 });
    const reads: string[] = [];
    const screensAtRead: string[] = [];
    const display = game.nhDisplay;
    assert.ok(display, 'The pager needs a display.');
    input.beforeRead = () => {
        reads.push(game._pending_message || '');
        screensAtRead.push(display.grid
            .slice(1).map(row => row.map(cell => cell.ch).join('')).join('\n'));
    };
    await restoregamePreamble();
    await flushPendingTopline();

    assert.equal(restored.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(reads.filter(message => message.includes('turns into')).length, 1,
        `Sensing announces the revert exactly once: ${reads.join(' | ')}`);
    assert.equal((screensAtRead[0] ?? '').trim(), '',
        'No map or status output is painted behind the restore message.');
    const topline = requireScreenRow(0).map(cell => cell.ch).join('');
    assert.match(topline, /welcome back to NetHack!/);
});
