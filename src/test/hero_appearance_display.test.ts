import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_FURNITURE, M_AP_MONSTER } from '../js/const.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the hero monster disguise is displayed before a transformation changes the real body', async () => {
    freshObjectRoom();
    const originalForm = game.u.umonnum;
    game.u.m_ap_type = M_AP_MONSTER;
    game.u.mappearance = MONSTER_NAME.indexOf('green slime');

    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);

    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, 'P');
    assert.equal(game.u.umonnum, originalForm);
});

void test('a hero furniture disguise uses the selected dungeon graphics without changing remembered terrain', async () => {
    const level = freshObjectRoom();
    game.symset = 'DECgraphics';
    game.u.m_ap_type = M_AP_FURNITURE;
    game.u.mappearance = CmapSymbol.hwall;
    const location = level.requireAt(game.u.ux, game.u.uy);
    const terrain = location.typ;

    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);

    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '─');
    assert.equal(location.typ, terrain);
    assert.equal(location.remembered_glyph?.kind, 'terrain');
    if (location.remembered_glyph?.kind === 'terrain')
        assert.equal(location.remembered_glyph.terrainName, 'floor of a room');
});
