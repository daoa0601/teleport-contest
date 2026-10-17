import test from 'node:test';
import assert from 'node:assert/strict';
// C display.c:map_glyphinfo() gives a polymorphed hero its species color;
// tty draws CLR_BLACK as dark gray because use_darkgray is on.
import { CLR_BLACK } from '../js/terminal.js';
import { displaySelf, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a hero polymorphed into a warg is drawn in dark gray', async () => {
    freshObjectRoom();
    installPolymorphedHero('warg');
    displaySelf();
    await flush_screen(1);
    const cell = game.nhDisplay?.grid[game.u.uy + 1]?.[game.u.ux - 1];
    assert.equal(cell?.ch, 'd');
    assert.equal(cell?.color, CLR_BLACK);
});
//# sourceMappingURL=hero_glyph_color.test.js.map