import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a red mold heals an iron golem and displays the restored HP', async () => {
    freshObjectRoom();
    installPolymorphedHero('iron golem', { hitPoints: 10, maxHitPoints: 40 });
    const mold = await createMonsterAt('red mold', 11, 10, NO_MINVENT);
    await bot();
    await applyHeroContactPassive(mold, { hit: true, random: () => 1, rollDice: () => 2 });
    await flush_screen(1);
    assert.equal(game.u.mh, 12);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:12\(40\)/);
});
//# sourceMappingURL=status_golem_healing.test.js.map