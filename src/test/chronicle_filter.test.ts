import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { recordAchievement } from '../js/achievements.js';
import { ACH_MINE_PRIZE, ACH_SHOP } from '../js/const.js';
import { LUCKSTONE } from '../js/object_data.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

// insight.c:show_gamelog() skips lines flagged LL_SPOILER unless the game
// runs in wizard mode (insight.c:2575); the Mines' End and Sokoban prize
// achievements carry LL_SPOILER because the prize type may still be
// unidentified (insight.c achieve_msg[]).
void test('the chronicle hides the Mines prize spoiler outside wizard mode', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    recordAchievement(game, ACH_SHOP);
    const pages: string[] = [];
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8, pages });

    await rhack('v'.charCodeAt(0));

    // show_gamelog() destroys its full-screen text window, so the map is
    // already back when 'v' finishes; the pages hold what the pager showed.
    const shown = pages.join('\n');
    assert.match(shown, /entered a shop/);
    assert.doesNotMatch(shown, /Mines' End luckstone/,
        'the undiscovered prize type is a chronicle spoiler');
});

void test('wizard mode shows the spoiler-flagged prize line', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.flags.debug = true;
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    const pages: string[] = [];
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8, pages });

    await rhack('v'.charCodeAt(0));

    assert.match(pages.join('\n'), /Mines' End luckstone/);
});

void test('a chronicle with only spoiler lines shows none', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    const pages: string[] = [];
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8, pages });

    await rhack('v'.charCodeAt(0));

    const shown = pages.join('\n');
    assert.match(shown, /Logged events: *\n none/,
        'show_gamelog() still opens the window with " none"');
    assert.doesNotMatch(shown, /Mines' End/);
});
