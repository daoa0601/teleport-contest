import assert from 'node:assert/strict';
import test from 'node:test';
import { D_CLOSED, DOOR, STAIRS } from '../js/const.js';
import { displaySelf, flush_screen, newsym, _statusLine2 } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CLR_GRAY, CLR_WHITE, NO_COLOR } from '../js/terminal.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// display.c:reset_glyphmap() clears every glyph color while
// GMAP_ROGUELEVEL is set and the default rogue symset provides no IBM
// color handling, so the Rogue level renders colorless.  map_glyphinfo()
// afterwards restores the showrace highlight on the hero's own glyph.

void test('a rogue level strips glyph colors behind rogue characters', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.symset = 'DECgraphics';

    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    const stairs = level.requireAt(13, 10);
    stairs.typ = STAIRS;
    level.upstair = { x: 13, y: 10 };
    game.stairs = { sx: 13, sy: 10, up: true, isladder: false,
        tolev: { dnum: 1, dlevel: 1 }, u_traversed: false, next: null };
    await createMonsterAt(MONSTER_NAME.indexOf('red mold'), 14, 10);

    newsym(12, 10);
    newsym(13, 10);
    newsym(14, 10);
    await flush_screen(1);

    const doorCell = requireGameDisplay().grid[11]?.[11];
    assert.equal(doorCell?.ch, '+');
    assert.equal(doorCell?.color, NO_COLOR);
    const stairCell = requireGameDisplay().grid[11]?.[12];
    assert.equal(stairCell?.ch, '%');
    assert.equal(stairCell?.color, NO_COLOR);
    const monsterCell = requireGameDisplay().grid[11]?.[13];
    assert.equal(monsterCell?.ch, 'F');
    assert.equal(monsterCell?.color, NO_COLOR);
});

void test('an ordinary stair keeps its gray color off the rogue level', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const stairs = level.requireAt(13, 10);
    stairs.typ = STAIRS;
    level.upstair = { x: 13, y: 10 };
    game.stairs = { sx: 13, sy: 10, up: true, isladder: false,
        tolev: { dnum: 1, dlevel: 1 }, u_traversed: false, next: null };

    newsym(13, 10);
    await flush_screen(1);

    const stairCell = requireGameDisplay().grid[11]?.[12];
    assert.equal(stairCell?.ch, '<');
    assert.equal(stairCell?.color, CLR_GRAY);
});

for (const showrace of [false, true]) {
    void test(`the hero glyph on a rogue level is ${showrace ? 'white with showrace' : 'uncolored without showrace'}`, async () => {
        freshObjectRoom({ flags: { showrace } });
        requirePlayingGame(game);
        game.rogue_level = { ...game.u.uz };

        displaySelf();
        await flush_screen(1);

        const heroCell = requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1];
        assert.equal(heroCell?.ch, '@');
        assert.equal(heroCell?.color, showrace ? CLR_WHITE : NO_COLOR);
    });
}

// botl.c builds the gold field header from the active symset's coin-class
// symbol, and symbols.c init_rogue_symbols() maps coins to GEM_SYM, so the
// Rogue level's status line counts gold under '*' instead of '$'.
void test('the Rogue level status line labels gold with the rogue coin symbol', () => {
    freshObjectRoom();
    requirePlayingGame(game);
    assert.match(_statusLine2(), /^[^ ]+ \$:/);

    game.rogue_level = { ...game.u.uz };
    assert.match(_statusLine2(), /^[^ ]+ \*:/);
});
