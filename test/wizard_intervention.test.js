import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
async function interventionTurn(seed, earlierMessage) {
    game._moveloopStarted = true;
    game.u.umovement = 12;
    initRng(BigInt(seed));
    const input = resetInputState();
    const messages = [];
    const pages = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (text.includes('--More--'))
            pages.push(game._pending_message);
    };
    installPagerInput(input, { expected: /^/, limit: 80 });
    input.feed('m.');
    await moveloop_core();
    if (earlierMessage)
        await plineWithContinuation(earlierMessage);
    await finishAtCommandInput(input, moveloop_core, /^/);
    return { text: messages.join('\n'), pages };
}
void test('a blind hero can be cursed by Wizard harassment without seeing a glow', async () => {
    let curses = 0;
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ hero: { blindTurns: 100, uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.level.flags.rndmongen = false;
        const dagger = await addInventoryObject(DAGGER, { cursed: false, blessed: false });
        const { text: messages } = await interventionTurn(seed);
        assert.doesNotMatch(messages, /glow surrounding you/);
        if (dagger.cursed)
            curses++;
    }
    assert.ok(curses > 0, 'Harassment still curses a blind hero’s inventory');
});
void test('Astral harassment never resurrects the Wizard', async () => {
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ hero: { uz: { dnum: 1, dlevel: 1 }, uevent: { udemigod: true }, udg_cnt: 1 } });
        requirePlayingGame(game);
        game.astral_level = { dnum: 1, dlevel: 1, flags: { town: false }, alignment: 0 };
        game.level.flags.rndmongen = false;
        const { text: messages } = await interventionTurn(seed);
        assert.equal(game.level.monsters.some(monster => monster.iswiz), false, `Astral harassment must use only outcomes 1 through 4: ${messages}`);
    }
});
void test('harassment acknowledges older prose before showing its nervousness or glow message', async () => {
    let glows = 0;
    let nervous = 0;
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
        const { text, pages } = await interventionTurn(seed, 'You inspect the quiet stone archway at the entrance to the passage.');
        const glow = text.includes('glow surrounding you.');
        const nerves = text.includes('vaguely nervous.');
        if (!glow && !nerves)
            continue;
        glows += Number(glow);
        nervous += Number(nerves);
        assert.match(pages[0] ?? '', /quiet stone archway/);
        assert.doesNotMatch(pages[0] ?? '', /glow surrounding you|vaguely nervous/, 'The first pager belongs only to the older announcement');
    }
    assert.ok(glows > 0, 'The turn samples must include visible curses');
    assert.ok(nervous > 0, 'The turn samples must include nervousness');
});
//# sourceMappingURL=wizard_intervention.test.js.map