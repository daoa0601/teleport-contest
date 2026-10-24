import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
// C insight.c:doborn() (#wizborn): one text window of per-species died/born
// counters with the gone flag (G genocided, E extinct, X otherwise) and the
// running totals last; species with no activity stay unlisted.
void test('#wizborn lists per-species birth and death counters with totals', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const ant = MONSTER_NAME.indexOf('giant ant');
    const newt = MONSTER_NAME.indexOf('newt');
    const gridBug = MONSTER_NAME.indexOf('grid bug');
    game.mvitals ??= [];
    game.mvitals[ant] = { born: 5, died: 2, mvflags: G_GENOD };
    game.mvitals[newt] = { born: 3, died: 1, mvflags: 0 };
    const input = resetInputState();
    let text = '';
    input.display = {
        async readKey() {
            text += '\n' + requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            return 32;
        },
    };
    try {
        await runExtendedCommand('wizborn');
    }
    finally {
        input.display = null;
    }
    assert.match(text, /died born/);
    assert.match(text, /   1    3   newt/);
    assert.match(text, /   3    8/);
    assert.ok(text.indexOf('giant ant') < text.indexOf('newt'), 'rows keep monster-index order');
    assert.ok(!text.includes(`${gridBug}`), 'untouched species stay unlisted');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_born_report.test.js.map