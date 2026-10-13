import test from 'node:test';
import assert from 'node:assert/strict';
import { pline } from '../js/display.js';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
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
//# sourceMappingURL=first_turn_death_messages.test.js.map