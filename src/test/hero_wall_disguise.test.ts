import assert from 'node:assert/strict';
import test from 'node:test';
import { M_AP_FURNITURE } from '../js/const.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from '../js/glyph_numbers.js';
import { flush_screen, glyphAt, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

for (const { branch, offset } of [
    { branch: 'The Gnomish Mines', offset: GlyphOffset.cmapMines },
    { branch: 'Gehennom', offset: GlyphOffset.cmapGehennom },
    { branch: 'Fort Ludios', offset: GlyphOffset.cmapKnox },
    { branch: 'Sokoban', offset: GlyphOffset.cmapSokoban },
]) {
    void test(`a hero wall disguise uses the ${branch} glyph range`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: branch, flags: { hellish: branch === 'Gehennom' } })];
        if (branch === 'The Gnomish Mines') game.mines_dnum = game.u.uz.dnum;
        if (branch === 'Fort Ludios') game.knox_level = createSpecialLevel(game.u.uz);
        if (branch === 'Sokoban') game.sokoban_dnum = game.u.uz.dnum;
        game.u.m_ap_type = M_AP_FURNITURE;
        game.u.mappearance = CmapSymbol.hwall;

        newsym(game.u.ux, game.u.uy);
        await flush_screen(1);

        assert.equal(glyphAt(game.u.ux, game.u.uy)?.glyph, cmapToGlyph(CmapSymbol.hwall, offset));
        assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '-');
    });
}
