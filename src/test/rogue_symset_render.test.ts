import assert from 'node:assert/strict';
import test from 'node:test';

import { BEAR_TRAP, HWALL, STAIRS, TLCORNER } from '../js/const.js';
import { displaySelf, flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { CLR_BROWN, CLR_YELLOW, NO_COLOR } from '../js/terminal.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// dat/symbols `start:` sets that a Rogue level can display layer their
// S_ entries over the base rogue set (symbols.c:load_symset() →
// update_rogue_symset() over init_rogue_symbols()).

function rogueLevel() {
    const level = freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    const wall = level.requireAt(12, 10);
    wall.typ = HWALL;
    const stairs = level.requireAt(13, 10);
    stairs.typ = STAIRS;
    level.upstair = { x: 13, y: 10 };
    game.stairs = { sx: 13, sy: 10, up: true, isladder: false,
        tolev: { dnum: 1, dlevel: 1 }, u_traversed: false, next: null };
    return level;
}

function rogueCell(x: number, y: number) {
    return requireGameDisplay().grid[y + 1]?.[x - 1];
}

void test('the Blank rogue symbol set blanks walls, stairs and coins', async () => {
    const level = rogueLevel();
    applyNethackrc('OPTIONS=roguesymset:Blank');
    await floorObject(GOLD_PIECE, 14, 10, { dknown: true });

    newsym(12, 10);
    newsym(13, 10);
    newsym(14, 10);
    await flush_screen(1);

    assert.equal(rogueCell(12, 10)?.ch, '\x1a');
    assert.equal(rogueCell(13, 10)?.ch, '\x1a');
    assert.equal(rogueCell(14, 10)?.ch, '\x1a');
    void level;
});

void test('RogueIBM draws double-line walls and Greek-Xi stairs', async () => {
    rogueLevel();
    applyNethackrc('OPTIONS=roguesymset:RogueIBM');

    newsym(12, 10);
    newsym(13, 10);
    await flush_screen(1);

    assert.equal(rogueCell(12, 10)?.ch, 'Í');
    assert.equal(rogueCell(13, 10)?.ch, 'ð');
    assert.equal(rogueCell(12, 10)?.color, NO_COLOR);
});

void test('plain as the rogue set redraws wall corners as plus', async () => {
    const level = rogueLevel();
    applyNethackrc('OPTIONS=roguesymset:plain');
    const corner = level.requireAt(12, 10);
    corner.typ = TLCORNER;
    corner.seenv = 255;

    newsym(12, 10);
    await flush_screen(1);

    assert.equal(rogueCell(12, 10)?.ch, '+');
});

void test('RogueEpyx replaces trap symbols and keeps rogue colors', async () => {
    const level = rogueLevel();
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');
    const trap = addTrap(level, BEAR_TRAP, 14, 10);
    trap.tseen = true;
    await floorObject(GOLD_PIECE, 15, 10, { dknown: true });

    newsym(12, 10);
    newsym(13, 10);
    newsym(14, 10);
    newsym(15, 10);
    await flush_screen(1);

    // The wall keeps cmap_to_roguecolor()'s brown, the trap shows the card
    // diamond, and a pile of coins renders with Epyx's coin symbol in
    // reset_glyphmap()'s rogue yellow.
    assert.equal(rogueCell(12, 10)?.ch, 'Í');
    assert.equal(rogueCell(12, 10)?.color, CLR_BROWN);
    assert.equal(rogueCell(14, 10)?.ch, '\x04');
    assert.equal(rogueCell(15, 10)?.ch, '\x0f');
    assert.equal(rogueCell(15, 10)?.color, CLR_YELLOW);
});

void test('RogueEpyx displays the hero with the human class symbol', async () => {
    rogueLevel();
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');

    displaySelf();
    await flush_screen(1);

    assert.equal(rogueCell(game.u.ux, game.u.uy)?.ch, '\x01');
    // map_glyphinfo() makes the hero yellow under rogue IBM color.
    assert.equal(rogueCell(game.u.ux, game.u.uy)?.color, CLR_YELLOW);
});

void test('the default rogue set still strips colors and shows percent stairs', async () => {
    rogueLevel();

    newsym(12, 10);
    newsym(13, 10);
    await flush_screen(1);

    assert.equal(rogueCell(12, 10)?.ch, '-');
    assert.equal(rogueCell(12, 10)?.color, NO_COLOR);
    assert.equal(rogueCell(13, 10)?.ch, '%');
    assert.equal(rogueCell(13, 10)?.color, NO_COLOR);
});
