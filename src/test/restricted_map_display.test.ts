import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { POOL } from '../js/const.js';
import { docrt, flush_screen, redrawMap, show_glyph_cell, under_ground, under_water } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { requireScreenCell } from './support/screen.js';

for (const mode of ['underwater', 'buried']) {
    void test(`a limited ${mode} redraw leaves temporary glyphs outside its old viewport alone`, async () => {
        const level = freshObjectRoom();
        if (mode === 'underwater') {
            for (let x = 7; x <= 16; x++)
                for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = POOL;
            game.u.uinwater = 1;
        } else game.u.uburied = true;
        await docrt();
        show_glyph_cell(16, 10, '!');
        await flush_screen(1);

        await redrawMap();
        await flush_screen(1);

        assert.equal(requireScreenCell(15, 11).ch, '!');
    });
}

for (const mode of ['underwater', 'buried']) {
    void test(`a delayed full ${mode} reset clears the map on the next update`, async () => {
        const level = freshObjectRoom();
        const update = mode === 'underwater' ? under_water : under_ground;
        if (mode === 'underwater') {
            level.requireAt(10, 10).typ = POOL;
            game.u.uinwater = 1;
        } else game.u.uburied = true;
        await update(1);
        show_glyph_cell(16, 10, '!');
        await flush_screen(1);

        await update(2);
        await flush_screen(1);
        assert.equal(requireScreenCell(15, 11).ch, '!');
        await update(0);
        await flush_screen(1);

        assert.equal(requireScreenCell(15, 11).ch, ' ');
    });
}

void test('an underground full reset leaves the hero blank until a limited update', async () => {
    freshObjectRoom();
    game.u.uburied = true;

    await under_ground(1);
    await flush_screen(1);
    assert.equal(requireScreenCell(9, 11).ch, ' ');
    await under_ground(0);
    await flush_screen(1);

    assert.equal(requireScreenCell(9, 11).ch, '@');
});

for (const mode of ['underwater', 'buried'] as const) {
    void test(`a timed action services a pending ${mode} display reset`, async () => {
        const input = freshTurnRoom();
        requirePlayingGame(game);
        if (mode === 'underwater') {
            for (let x = 8; x <= 18; x++)
                for (let y = 8; y <= 12; y++) game.level.requireAt(x, y).typ = POOL;
            game.u.uinwater = 1;
            grantIntrinsicProperty('swimming', 'outside');
            grantIntrinsicProperty('magicalBreathing', 'outside');
        } else game.u.uburied = true;
        installPagerInput(input, { expected: /^$/, limit: 1 });
        input.feed('.');
        await moveloop_core();
        const update = mode === 'underwater' ? under_water : under_ground;
        await update(1);
        show_glyph_cell(16, 10, '!');
        await update(2);
        await flush_screen(1);
        assert.equal(requireScreenCell(15, 11).ch, '!');

        await finishAtCommandInput(input, moveloop_core, /^$/);

        assert.equal(requireScreenCell(15, 11).ch, ' ');
    });
}
