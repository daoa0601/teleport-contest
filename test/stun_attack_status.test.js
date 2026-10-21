import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function screenRow(row) {
    return requireGameDisplay().grid.at(row)?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('a stunning kick reports the stagger before the status shows Stun', async () => {
    freshObjectRoom({ right: 20 });
    requirePlayingGame(game);
    const abbot = await createMonsterAt('abbot', game.u.ux + 1, game.u.uy, NO_MINVENT);
    abbot.mpeaceful = false;
    abbot.msleeping = 0;
    abbot.mux = game.u.ux;
    abbot.muy = game.u.uy;
    // A long name makes the kick message overflow before "You stagger...".
    abbot.mgivenname = 'Brother Bartholomew of the Very Long and Winding Abbey Road';
    const pages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        const top = `${screenRow(0)} ${screenRow(1)}`.trim();
        pages.push({ top, status: screenRow(-1) });
        if (pages.length > 20)
            throw new Error('Unexpected repeated input');
        if (top.includes('--More--'))
            input.feed(' ');
    };
    await performMonsterHeroAttack(abbot, game, {
        random: () => 0, rollDice: count => count, rollOne: () => 1,
    });
    assert.ok((game.u.stunnedTurns ?? 0) > 0, 'the kick must stun the hero');
    const kickPage = pages.find(page => /kicks!--More--$/.test(page.top));
    assert.ok(kickPage, pages.map(page => page.top).join('\n'));
    assert.doesNotMatch(kickPage.status, /Stun/, "make_stunned() prints its message before the status can show Stun");
});
//# sourceMappingURL=stun_attack_status.test.js.map