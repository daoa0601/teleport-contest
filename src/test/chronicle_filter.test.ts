import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { recordAchievement } from '../js/achievements.js';
import { ACH_MINE_PRIZE, ACH_SHOP } from '../js/const.js';
import { LUCKSTONE } from '../js/object_data.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

function screen(): string {
    return requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
}

// insight.c:show_gamelog() skips lines flagged LL_SPOILER unless the game
// runs in wizard mode (insight.c:2575); the Mines' End and Sokoban prize
// achievements carry LL_SPOILER because the prize type may still be
// unidentified (insight.c achieve_msg[]).
void test('the chronicle hides the Mines prize spoiler outside wizard mode', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    recordAchievement(game, ACH_SHOP);
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8 });

    await rhack('v'.charCodeAt(0));

    const shown = screen();
    assert.match(shown, /entered a shop/);
    assert.doesNotMatch(shown, /Mines' End luckstone/,
        'the undiscovered prize type is a chronicle spoiler');
});

void test('wizard mode shows the spoiler-flagged prize line', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.flags.debug = true;
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8 });

    await rhack('v'.charCodeAt(0));

    assert.match(screen(), /Mines' End luckstone/);
});

void test('a chronicle with only spoiler lines shows none', async () => {
    freshTurnRoom({ flags: { tips: false }, hero: { uachieved: [] } });
    game.context.achieveo = { mines_prize_otyp: LUCKSTONE };
    recordAchievement(game, ACH_MINE_PRIZE);
    installPagerInput(resetInputState(), { expected: /.*/, limit: 8 });

    await rhack('v'.charCodeAt(0));

    const shown = screen();
    assert.match(shown, /Logged events: *\n none/,
        'show_gamelog() still opens the window with " none"');
    assert.doesNotMatch(shown, /Mines' End/);
});
