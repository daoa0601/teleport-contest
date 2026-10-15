import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD } from '../js/const.js';
import { doquit } from '../js/end.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('quit disclosure reports broken conducts and achievements from game history', async () => {
    freshObjectRoom({ flags: { debug: true, disclose: '-i -a -v -g +c -o', tombstone: false } });
    requirePlayingGame(game);
    game.iflags.toptenwin = false;
    game.u.uconduct = { wishes: 2, wisharti: 2, weaphit: 1, literate: 3, polypiles: 4, polyselfs: 1, sokocheat: 2 };
    game.u.uachieved = [21, 23];
    game.u.uroleplay.blind = true;
    const newt = MONSTER_NAME.indexOf('newt');
    game.mvitals ??= [];
    game.mvitals[newt] = { born: 0, died: 0, mvflags: G_GENOD };
    const screens = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(screen);
            assert.ok(screens.length < 16, `Unexpected ending prompt: ${screen}`);
            return (screen.includes('Really quit without saving?') ? 'y'
                : screen.includes('Dump core?') ? 'n' : ' ').charCodeAt(0);
        },
    };
    await doquit();
    const conduct = screens.filter(screen => /Voluntary challenges:|Achievement|Sokoban/.test(screen)).join('\n');
    assert.match(conduct, /You used 2 wishes \(both for artifacts\)\./);
    assert.match(conduct, /You genocided 1 type of monster\./);
    assert.match(conduct, /You hit with a wielded weapon 1 time\./);
    assert.match(conduct, /You read items or engraved 3 times\./);
    assert.match(conduct, /You polymorphed 4 items\./);
    assert.match(conduct, /You changed form 1 time\./);
    assert.match(conduct, /You violated the special Sokoban rules twice\./);
    assert.match(conduct, /You entered Sokoban\./);
    assert.match(conduct, /You explored without being able to see\./);
});
//# sourceMappingURL=end_conduct.test.js.map