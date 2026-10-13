import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { damageHeroFromMonster } from '../js/hero_damage.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
for (const moves of [1, 2]) {
    void test(`death on turn ${moves} ${moves === 1 ? 'includes' : 'omits'} the early-death farewell`, async () => {
        freshObjectRoom({ moves, flags: { bones: false, tombstone: false, disclose: '-i -a -v -c -o' } });
        game.storage = memoryStorage();
        await pline('You die...');
        const input = resetInputState();
        const pages = [];
        input.beforeRead = () => {
            pages.push(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '');
        };
        installPagerInput(input, { expected: /You die|Goodbye|points/, limit: 4 });
        await finishOrdinaryDeath({ killer: 'a falling rock' });
        assert.equal(pages.some(message => /Do not pass Go\.  Do not collect 200 zorkmids\./.test(message)), moves === 1);
        assert.equal(game.program_state.gameover, true);
    });
}
void test('a first-turn fatal hit ending at minus one displays zero HP during the farewell', async () => {
    freshObjectRoom({
        moves: 1,
        hero: { uhp: 4, uhpmax: 12 },
        flags: { bones: false, tombstone: false, disclose: '-i -a -v -g -c -o' },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const monster = await createMonsterAt('newt', game.u.ux + 1, game.u.uy, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    const input = resetInputState();
    let sawHit = false;
    let sawFarewell = false;
    input.beforeRead = () => {
        const display = requireGameDisplay();
        const message = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
        const status = display.grid[23]?.map(cell => cell.ch).join('') ?? '';
        if (message.includes('The newt bites!')) {
            sawHit = true;
            assert.equal(game.u.uhp, -1, 'The hit is acknowledged before done() commits zero HP.');
            assert.match(status, /HP:4\(12\)/, 'The minus-one sentinel preserves status during the hit.');
        }
        if (message.includes('Do not pass Go.')) {
            sawFarewell = true;
            assert.equal(game.u.uhp, 0);
            assert.match(status, /HP:0\(12\)/, 'The farewell must display the committed zero HP.');
        }
    };
    installPagerInput(input, { expected: /newt|die|Do not pass Go|Goodbye|points/, limit: 8 });
    await flush_screen(1);
    await plineWithContinuation('The newt bites!');
    const died = await damageHeroFromMonster(monster, 5);
    assert.equal(died, true);
    assert.equal(sawHit, true, 'The lethal hit must reach its message pager.');
    assert.equal(sawFarewell, true, 'The first-turn farewell must reach its message pager.');
    assert.equal(game.u.umortality, 1);
});
//# sourceMappingURL=first_turn_death_messages.test.js.map