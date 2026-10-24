import assert from 'node:assert/strict';
import test from 'node:test';
import { BY_COOKIE, BY_OTHER, BY_PAPER, FAINTED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import * as rumors from '../js/rumor.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function collectRumorPages() {
    const pages = [];
    const input = resetInputState();
    input.beforeRead = () => { pages.push(game._pending_message); };
    installPagerInput(input, { expected: /\S/, limit: 4 });
    return pages;
}
void test('a paper rumor introduces its text without announcing a cookie', async () => {
    freshObjectRoom();
    const pages = collectRumorPages();
    await rumors.outRumor(1, BY_PAPER);
    const text = [...pages, game._pending_message].join('\n');
    assert.match(text, /^It reads:/);
    assert.doesNotMatch(text, /This cookie has a scrap of paper inside\./);
    assert.ok(game._pending_message.replace('It reads:', '').trim(), 'The paper must contain a rumor');
    assert.equal(game.u.uconduct?.literate ?? 0, 0, 'The caller records literacy');
});
void test('a blind hero cannot read a paper rumor', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    await rumors.outRumor(1, BY_PAPER);
    assert.equal(game._pending_message, 'What a pity that you cannot read it!');
});
void test('paper rumors still print when the hero has fainted', async () => {
    freshObjectRoom({ hero: { uhs: FAINTED } });
    const pages = collectRumorPages();
    await rumors.outRumor(1, BY_PAPER);
    assert.match([...pages, game._pending_message].join('\n'), /^It reads:/);
});
void test('a cookie fortune is suppressed while the hero has fainted', async () => {
    freshObjectRoom({ hero: { uhs: FAINTED } });
    await rumors.outRumor(1, BY_COOKIE);
    assert.equal(game._pending_message, '');
});
void test('other rumor delivery prints the rumor without a reading or speaker introduction', async () => {
    freshObjectRoom({ hero: { blindTurns: 10 } });
    const pages = collectRumorPages();
    await rumors.outRumor(1, BY_OTHER);
    const text = [...pages, game._pending_message].join('\n');
    assert.ok(text.trim(), 'The rumor must be delivered even while blind');
    assert.doesNotMatch(text, /It reads:|This cookie has a scrap of paper inside\.|True to her word, the Oracle/);
});
//# sourceMappingURL=rumor_delivery.test.js.map