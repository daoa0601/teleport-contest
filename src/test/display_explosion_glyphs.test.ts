import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPL_DARK, EXPL_FIERY, MAGIC_TRAP, NO_MINVENT } from '../js/const.js';
import { digHole } from '../js/digging_terrain.js';
import { glyphAt } from '../js/display.js';
import { explode } from '../js/explosion.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLR_BRIGHT_BLUE, CLR_MAGENTA, CLR_ORANGE } from '../js/terminal.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

const SCROLL_CLASS = 9;

void test('an ASCII explosion keeps its border position and fiery glyph type', async () => {
    freshObjectRoom();
    game.symset = 'ASCII';
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        assert.equal(requireScreenCell(13, 10).ch, '-');
        assert.equal(glyphAt(14, 9)?.glyph, GlyphOffset.explodeFiery + 1);
    };

    await explode(14, 10, 11, 0, 9, EXPL_FIERY);

    assert.ok(frames > 0);
});

void test('a default game shows the shield of a monster resisting an explosion', async () => {
    freshObjectRoom();
    assert.equal(game.flags.sparkle, undefined);
    game.symset = 'ASCII';
    await createMonsterAt('red mold', 15, 10, NO_MINVENT);
    let shieldFrames = 0;
    game.animationFrame = async () => {
        if (requireScreenCell(14, 11).color === CLR_BRIGHT_BLUE) shieldFrames++;
    };

    await explode(14, 10, 11, 0, SCROLL_CLASS, EXPL_FIERY);

    assert.ok(shieldFrames > 0);
});

void test('a dark explosion uses the default fiery glyph and orange border', async () => {
    freshObjectRoom();
    game.symset = 'ASCII';
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        const top = requireScreenCell(13, 10);
        assert.equal(top.ch, '-');
        assert.equal(top.color, CLR_ORANGE);
        assert.equal(glyphAt(14, 9)?.glyph, GlyphOffset.explodeFiery + 1);
    };

    await explode(14, 10, 11, 0, SCROLL_CLASS, EXPL_DARK);

    assert.ok(frames > 0);
});

void test('digging into a magic trap uses the same magical explosion glyphs', async () => {
    const level = freshObjectRoom({ hero: { uhp: 1000, uhpmax: 1000 } });
    game.symset = 'ASCII';
    addTrap(level, MAGIC_TRAP, 10, 10);
    installPagerInput(resetInputState(), { expected: /trap|blast|Boom|caught/, limit: 8 });
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        const top = requireScreenCell(9, 10);
        assert.equal(top.ch, '-');
        assert.equal(top.color, CLR_MAGENTA);
        assert.equal(glyphAt(10, 9)?.glyph, GlyphOffset.explodeMagical + 1);
    };

    await digHole({});

    assert.ok(frames > 0);
});
