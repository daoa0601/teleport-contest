import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

function fileErrors(rc: string) {
    return parseNethackrc(rc).configErrors[0]?.errors ?? [];
}

// options.c:optfn_boulder() writes the override into both symbol sets, so
// it also reaches the Rogue level; the BOULDER= statement (cfgfiles.c
// cnf_line_BOULDER()) fills the primary set only.
void test('the boulder option overrides the Rogue level boulder symbol', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=boulder:\\57');
    game.rogue_level = { ...game.u.uz };

    await floorObject(BOULDER, 11, 10, { dknown: true });
    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '9');
    delete game.rogue_level;
});

void test('the BOULDER statement leaves the Rogue level boulder symbol alone', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    applyNethackrc('BOULDER=57');
    game.rogue_level = { ...game.u.uz };

    await floorObject(BOULDER, 11, 10, { dknown: true });
    newsym(11, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(10, 11).ch, '`');
    delete game.rogue_level;

    // Off the Rogue level the statement still applies.
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '9');
});

void test('the boulder option refuses clashing symbols', () => {
    assert.deepEqual(fileErrors('OPTIONS=boulder:a').map(error => error.message),
        ["Badoption - boulder symbol 'a' would conflict with a monster symbol"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder:2').map(error => error.message),
        ["Badoption - boulder symbol '2' would conflict with a warning symbol"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder:^A').map(error => error.message),
        ['boulder symbol cannot be a control character']);
    assert.deepEqual(fileErrors('OPTIONS=boulder:').map(error => error.message),
        ["Missing parameter for 'boulder:'"]);
    assert.deepEqual(fileErrors('OPTIONS=boulder').map(error => error.message),
        ["Missing parameter for 'boulder'"]);
    // '0' is warning symbol zero, which the C clash test skips.
    assert.deepEqual(fileErrors('OPTIONS=boulder:0').map(error => error.message),
        []);
});

// pager.c resolves ROCK_CLASS against the boulder override in the typed
// look pass, so the default '`' stops meaning boulder while the override
// character gains the meaning.
void test('typed look moves the boulder meaning to the override symbol', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    applyNethackrc('OPTIONS=boulder:0');
    const first = resetInputState();
    first.feed('/?0\n');
    await rhack(0);
    await flush_screen(1);
    const zero = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';

    const second = resetInputState();
    second.feed('/?`\n');
    await rhack(0);
    await flush_screen(1);
    const grave = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim() ?? '';

    assert.match(zero, /^0 +a boulder or an iron ball$/, zero);
    assert.doesNotMatch(grave, /boulder/, grave);
    assert.match(grave, /^` +an engraving$/, grave);
});
