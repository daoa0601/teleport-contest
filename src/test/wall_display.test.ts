import test from 'node:test';
import assert from 'node:assert/strict';
import { STONE, SV3, SV4, SV5, SV7, TDWALL, VWALL, WM_C_INNER } from '../js/const.js';
import { CmapSymbol, cmapToGlyph } from '../js/glyph_numbers.js';
import { back_to_glyph, set_wall_state, xy_set_wall_state } from '../js/display.js';
import { freshObjectRoom } from './support/object-room.js';

void test('xy_set_wall_state records an unfinished exterior wall face', async () => {
    const level = await freshObjectRoom();
    const wall = level.requireAt(12, 10);
    wall.typ = VWALL;
    level.requireAt(11, 10).typ = STONE; // rock beside the left face

    xy_set_wall_state(12, 10);

    assert.equal((wall.wall_info ?? 0) & 0x07, 1,
        'rock on the left leaves the left face unfinished');

    // A finished wall between two rooms keeps mode 0.
    const inner = level.requireAt(9, 10);
    inner.typ = VWALL;
    xy_set_wall_state(9, 10);
    assert.equal((inner.wall_info ?? 0) & 0x07, 0);
});

void test('set_wall_state scans the level through xy_set_wall_state', async () => {
    const level = await freshObjectRoom();
    const wall = level.requireAt(12, 10);
    wall.typ = VWALL;
    level.requireAt(11, 10).typ = STONE;
    wall.wall_info = WM_C_INNER; // a stale mode the scan must replace

    set_wall_state();

    assert.equal((wall.wall_info ?? 0) & 0x07, 1);
});

void test('wall_angle projects the unfinished face of a seen wall', async () => {
    const level = await freshObjectRoom();
    const wall = level.requireAt(12, 10);
    wall.typ = VWALL;
    level.requireAt(11, 10).typ = STONE;
    xy_set_wall_state(12, 10);

    // Seen only from the unfinished rock side: wall_angle() reports stone.
    wall.seenv = SV7;
    const unseen = back_to_glyph(wall, 12, 10);
    assert.equal(unseen.ch, ' ');
    assert.equal(unseen.glyph, cmapToGlyph(CmapSymbol.stone));

    // Seen from the finished side: the wall itself shows.
    wall.seenv = SV3;
    assert.equal(back_to_glyph(wall, 12, 10).glyph, cmapToGlyph(VWALL));

    // A finished wall is visible from any side.
    wall.wall_info = 0;
    assert.equal(back_to_glyph(wall, 12, 10).glyph, cmapToGlyph(VWALL));
});

void test('a T wall seen only along its stem projects a corner', async () => {
    const level = await freshObjectRoom();
    const wall = level.requireAt(12, 10);
    wall.typ = TDWALL;
    wall.wall_info = 0;

    wall.seenv = SV4; // a lone seen vector along the stem
    assert.equal(back_to_glyph(wall, 12, 10).glyph, cmapToGlyph(CmapSymbol.tlcorn));

    wall.seenv = SV3 | SV4 | SV5; // seen vectors spanning the crossbar
    assert.equal(back_to_glyph(wall, 12, 10).glyph, cmapToGlyph(CmapSymbol.tdwall));
});
