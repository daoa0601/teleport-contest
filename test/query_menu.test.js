import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSpiderAbility } from '../js/hero_web.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { promptYesNo, promptYesNoAllQuit, yn_function } from '../js/query.js';
import { freshPlayableRoom } from './support/playable-room.js';
function enableQueryMenu() {
    freshPlayableRoom();
    game.flags.query_menu = true;
    return resetInputState();
}
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n') ?? '';
}
void test('query_menu offers named answers and accepts a different choice from its default', async () => {
    const input = enableQueryMenu();
    const answer = promptYesNo('Continue studying?', 'n');
    try {
        await input.waitUntilBlocked();
        assert.match(screen(), /y - Yes/);
        assert.match(screen(), /n \* No/);
    }
    finally {
        input.feed('y');
        assert.equal(await answer, 'y');
    }
});
void test('Escape from a query menu accepts its selected default', async () => {
    const input = enableQueryMenu();
    const answer = promptYesNo('Continue studying?', 'y');
    await input.waitUntilBlocked();
    input.feed('\x1b');
    assert.equal(await answer, 'y');
});
void test('query menus include all and quit for a repeated item decision', async () => {
    const input = enableQueryMenu();
    const answer = promptYesNoAllQuit('Sell this lamp?', 'y');
    try {
        await input.waitUntilBlocked();
        assert.match(screen(), /a - All/);
        assert.match(screen(), /q - Quit/);
    }
    finally {
        input.feed('a');
        assert.equal(await answer, 'a');
    }
});
void test('a hand query offers right and left without changing the last numeric answer', async () => {
    const input = enableQueryMenu();
    game._ynNumber = 7n;
    const answer = yn_function('Which ring-finger, Right or Left?', 'rl', '', true, { menuable: true });
    try {
        await input.waitUntilBlocked();
        assert.match(screen(), /r - Right/);
        assert.match(screen(), /l - Left/);
    }
    finally {
        input.feed('l');
        const result = await answer;
        assert.equal(result.answer, 'l');
        assert.equal(result.count, 7n);
    }
});
void test('a spider chooses hide or web spinning through the response menu', async () => {
    const input = enableQueryMenu();
    const answer = chooseSpiderAbility();
    try {
        await input.waitUntilBlocked();
        assert.match(screen(), /h - Hide/);
        assert.match(screen(), /s - Spin a web/);
        assert.match(screen(), /q \* Quit/);
    }
    finally {
        input.feed('s');
        assert.equal(await answer, 'spin');
    }
});
//# sourceMappingURL=query_menu.test.js.map