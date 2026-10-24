import assert from 'node:assert/strict';
import test from 'node:test';
import { HWALL, M_AP_FURNITURE } from '../js/const.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from '../js/glyph_numbers.js';
import { flush_screen, glyphAt, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { CLR_BLUE, CLR_BROWN, CLR_GRAY, CLR_RED, CLR_YELLOW, NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

void test('real Fort Ludios walls use the yellow DECgraphics color', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    game.knox_level = createSpecialLevel(game.u.uz);
    level.requireAt(10, 9).typ = HWALL;

    newsym(10, 9);
    await flush_screen(1);

    assert.equal(requireGameDisplay().grid[10]?.[9]?.color, CLR_YELLOW);
});

void test('real Fort Ludios walls use the default gray ASCII foreground', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.symset = '';
    game.knox_level = createSpecialLevel(game.u.uz);
    level.requireAt(10, 9).typ = HWALL;

    newsym(10, 9);
    await flush_screen(1);

    const cell = requireGameDisplay().grid[10]?.[9];
    assert.equal(cell?.ch, '-');
    assert.equal(cell?.color, NO_COLOR);
});
for (const { branch, hellish } of [
    { branch: 'The Gnomish Mines', hellish: false },
    { branch: 'Gehennom', hellish: true },
]) {
    void test(`real ${branch} walls use the default gray ASCII foreground`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        game.symset = '';
        game.dungeons = [createDungeon({ dname: branch, flags: { hellish } })];
        level.requireAt(10, 9).typ = HWALL;

        newsym(10, 9);
        await flush_screen(1);

        const cell = requireGameDisplay().grid[10]?.[9];
        assert.equal(cell?.ch, '-');
        assert.equal(cell?.color, NO_COLOR);
    });
}

for (const symset of ['DECgraphics', 'curses', 'IBMgraphics', 'IBMGraphics_1', 'IBMGraphics_2']) {
    for (const { branch, color } of [
        { branch: 'The Gnomish Mines', color: CLR_BROWN },
        { branch: 'Gehennom', color: CLR_RED },
        { branch: 'Sokoban', color: CLR_BLUE },
        { branch: 'Fort Ludios', color: CLR_YELLOW },
    ]) {
        void test(`${symset} colors real ${branch} walls`, async () => {
            const level = freshObjectRoom();
            requirePlayingGame(game);
            game.symset = symset;
            game.dungeons = [createDungeon({ dname: branch, flags: { hellish: branch === 'Gehennom' } })];
            if (branch === 'Sokoban') game.sokoban_dnum = game.u.uz.dnum;
            if (branch === 'Fort Ludios') game.knox_level = createSpecialLevel(game.u.uz);
            level.requireAt(10, 9).typ = HWALL;

            newsym(10, 9);
            await flush_screen(1);

            assert.equal(requireScreenCell(9, 10).color, color);
        });
    }
}

for (const symset of ['plain', 'MACgraphics']) {
    void test(`${symset} leaves real Mines walls gray`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        game.symset = symset;
        game.dungeons = [createDungeon({ dname: 'The Gnomish Mines' })];
        level.requireAt(10, 9).typ = HWALL;

        newsym(10, 9);
        await flush_screen(1);

        assert.equal(requireScreenCell(9, 10).color, NO_COLOR);
    });
}

void test('curses Mines wall colors respect the color option', async () => {
    const level = freshObjectRoom({ flags: { color: false } });
    requirePlayingGame(game);
    game.symset = 'curses';
    game.dungeons = [createDungeon({ dname: 'The Gnomish Mines' })];
    level.requireAt(10, 9).typ = HWALL;

    newsym(10, 9);
    await flush_screen(1);

    assert.equal(requireScreenCell(9, 10).color, NO_COLOR);
});

for (const { branch, offset, color } of [
    { branch: 'The Gnomish Mines', offset: GlyphOffset.cmapMines, color: CLR_BROWN },
    { branch: 'Gehennom', offset: GlyphOffset.cmapGehennom, color: CLR_RED },
    { branch: 'Fort Ludios', offset: GlyphOffset.cmapKnox, color: CLR_YELLOW },
    { branch: 'Sokoban', offset: GlyphOffset.cmapSokoban, color: CLR_BLUE },
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

    void test(`a DECgraphics hero wall disguise uses ${branch} wall colors`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: branch, flags: { hellish: branch === 'Gehennom' } })];
        if (branch === 'The Gnomish Mines') game.mines_dnum = game.u.uz.dnum;
        if (branch === 'Fort Ludios') game.knox_level = createSpecialLevel(game.u.uz);
        if (branch === 'Sokoban') game.sokoban_dnum = game.u.uz.dnum;
        game.symset = 'DECgraphics';
        game.u.m_ap_type = M_AP_FURNITURE;
        game.u.mappearance = CmapSymbol.hwall;

        newsym(game.u.ux, game.u.uy);
        await flush_screen(1);

        const cell = requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1];
        assert.equal(cell?.ch, '─');
        assert.equal(cell?.color, color);
    });
}

for (const { title, branch, appearance, ch, color, symset, useColor } of [
    {
        title: 'an ordinary Mines hero wall disguise remains gray', branch: 'The Gnomish Mines',
        appearance: CmapSymbol.hwall, ch: '-', color: CLR_GRAY,
        symset: '', useColor: true,
    },
    {
        title: 'a DECgraphics open-door hero disguise stays brown in Gehennom', branch: 'Gehennom',
        appearance: CmapSymbol.vodoor, ch: '▒', color: CLR_BROWN,
        symset: 'DECgraphics', useColor: true,
    },
    {
        title: 'a DECgraphics Mines hero wall disguise is uncolored when color is disabled', branch: 'The Gnomish Mines',
        appearance: CmapSymbol.hwall, ch: '─', color: NO_COLOR,
        symset: 'DECgraphics', useColor: false,
    },
]) {
    void test(title, async () => {
        freshObjectRoom({ flags: { color: useColor } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: branch, flags: { hellish: branch === 'Gehennom' } })];
        game.symset = symset;
        game.u.m_ap_type = M_AP_FURNITURE;
        game.u.mappearance = appearance;

        newsym(game.u.ux, game.u.uy);
        await flush_screen(1);

        const cell = requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1];
        assert.equal(cell?.ch, ch);
        assert.equal(cell?.color, color);
    });
}
