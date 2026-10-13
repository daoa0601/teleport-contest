import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { checkHeroAttackOverexertion } from '../js/hero_overexertion.js';
import { BOULDER } from '../js/object_data.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const polymorphed of [false, true]) {
    void test(`attack exertion displays the reduced ${polymorphed ? 'monster-form' : 'human'} HP`, async () => {
        freshObjectRoom({ moves: 1 });
        if (polymorphed)
            installPolymorphedHero('wolf');
        await addInventoryObject(BOULDER);
        game._encumbranceLevel = nearCapacity(game);
        await bot();
        const stopped = await checkHeroAttackOverexertion();
        await flush_screen(1);
        assert.equal(stopped, false);
        assert.equal(polymorphed ? game.u.mh : game.u.uhp, 39);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:39\(40\)/);
    });
}
//# sourceMappingURL=status_overexertion.test.js.map