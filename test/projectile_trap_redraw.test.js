import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW_TRAP, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerImmediateMonsterTrap } from '../js/monmove.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('revealing an arrow trap displays its victim before announcing the hit', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const centaur = await createMonsterAt('plains centaur', 12, 10, NO_MINVENT);
    centaur.mx = 11;
    newsym(12, 10);
    addTrap(level, ARROW_TRAP, 11, 10);
    await triggerImmediateMonsterTrap(centaur, game);
    const glyph = glyphAt(11, 10);
    assert.equal(glyph?.kind, 'monster');
    assert.ok(glyph?.kind === 'monster');
    assert.equal(glyph.mnum, centaur.mnum);
});
//# sourceMappingURL=projectile_trap_redraw.test.js.map