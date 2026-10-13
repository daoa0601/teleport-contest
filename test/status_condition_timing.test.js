import test from 'node:test';
import assert from 'node:assert/strict';
import { HUNGRY, NOT_HUNGRY } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { spendHeroNutrition } from '../js/hunger.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a Hungry transition changes status after its announcement is acknowledged', async () => {
    freshObjectRoom({ hero: { uhunger: 151, uhs: NOT_HUNGRY } });
    await plineWithContinuation('You hear the footsteps of a guard approaching from the corridor.');
    const input = resetInputState();
    let pages = 0;
    input.display = {
        async readKey() {
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /--More--/);
            assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Hungry/);
            assert.equal(game.u.uhs, NOT_HUNGRY);
            pages++;
            return 32;
        },
    };
    await spendHeroNutrition(1);
    assert.equal(pages, 1);
    assert.equal(game.u.uhs, HUNGRY);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Hungry/);
});
//# sourceMappingURL=status_condition_timing.test.js.map