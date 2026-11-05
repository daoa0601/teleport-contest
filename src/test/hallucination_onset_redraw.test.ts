import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initRng, rn2Display } from '../js/rng.js';
import { makeHallucinated } from '../js/potion.js';
import { CLR_GRAY, NO_COLOR } from '../js/terminal.js';
import {
    MONSTER_COLOR, SPECIAL_PM, monsterClassSymbol,
} from '../js/monster_data.js';

import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

// C potion.c:make_hallucinated() redraws the map when hallucination toggles:
// see_monsters(), see_objects(), see_traps() (potion.c:423-427), in that
// order.  Under Hallucination each visible monster is drawn as a random
// species — display.c display_monster() takes it from what_mon()/random_
// monster(rng(NUMMONS)), one display-RNG draw per monster in fmon order —
// and the glyph carries that species' own symbol and color
// (display.c reset_glyphmap: symidx = mons[offset].mlet, mon_color(offset)),
// with the tty dropping plain gray (display.c:3079 has_color()).
const SEED = 91n;
function expectedSpeciesGlyph(mnum: number) {
    const color = MONSTER_COLOR[mnum];
    return {
        ch: monsterClassSymbol(mnum) || '?',
        color: color === CLR_GRAY ? NO_COLOR : color,
    };
}

void test('hallucination onset redraws each visible monster as the next random species', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.level.flags.rndmongen = false;
    const firstCreated = await createMonsterAt('orc', 11, 9);
    const secondCreated = await createMonsterAt('goblin', 11, 11);

    // fmon is newest-first, so the later creation is redrawn first.
    initRng(SEED);
    const firstDrawn = rn2Display(MONSTER_COLOR.length);
    const secondDrawn = rn2Display(MONSTER_COLOR.length);
    const later = expectedSpeciesGlyph(firstDrawn);
    const earlier = expectedSpeciesGlyph(secondDrawn);
    assert.notEqual(`${later.ch}/${later.color}`, `${earlier.ch}/${earlier.color}`,
        'the seed must give the two draws distinct appearances');

    initRng(SEED);
    await makeHallucinated(20, { talk: false });
    await flush_screen(1);

    const laterCell = requireScreenCell(secondCreated.mx - 1, secondCreated.my + 1);
    const earlierCell = requireScreenCell(firstCreated.mx - 1, firstCreated.my + 1);
    assert.deepEqual({ ch: laterCell.ch, color: laterCell.color }, later,
        'the first redrawn monster takes the first random species');
    assert.deepEqual({ ch: earlierCell.ch, color: earlierCell.color }, earlier,
        'the second redrawn monster takes the next random species');
});

// C display.h random_monster(rng) is rng(NUMMONS), so a hallucinated
// monster can be any species including the special ones past SPECIAL_PM;
// the glyph and color tables cover the whole draw.
void test('the hallucination species draw covers the whole monster table', async () => {
    assert.ok(MONSTER_COLOR.length > SPECIAL_PM,
        'the draw range includes the special species');
});
