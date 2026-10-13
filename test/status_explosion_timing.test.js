import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPL_NOXIOUS, MON_EXPLODE, PHYS_EXPL_TYPE } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { explode } from '../js/explosion.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('an explosion displays the hero injury on the next status flush', async () => {
    freshObjectRoom();
    await bot();
    pushKeys(' ');
    await explode(game.u.ux, game.u.uy, PHYS_EXPL_TYPE, 5, MON_EXPLODE, EXPL_NOXIOUS);
    await flush_screen(1);
    assert.equal(game.u.uhp, 35);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:35\(40\)/);
});
//# sourceMappingURL=status_explosion_timing.test.js.map