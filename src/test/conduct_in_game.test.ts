import assert from 'node:assert/strict';
import test from 'node:test';
import { ACH_AMUL, ACH_SHOP, ACH_SOKO, G_GENOD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { currentConductLines } from '../js/insight.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';

// C insight.c:show_conduct(ENL_GAMEINPROGRESS): the in-game #conduct view
// reports genocides, wish details, Sokoban rule violations, and (in wizard
// mode) every achievement with present-tense wording.
void test('#conduct reports broken conducts and achievements in present tense', () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.u.uconduct = { wishes: 3, wisharti: 1, sokocheat: 1 };
    game.u.uachieved = [ACH_SOKO, ACH_SHOP];
    const newt = MONSTER_NAME.indexOf('newt');
    game.mvitals ??= [];
    game.mvitals[newt] = { born: 0, died: 0, mvflags: G_GENOD };

    const lines = currentConductLines().join('\n');

    assert.match(lines, /You have genocided 1 type of monster\./);
    assert.match(lines, /You have used 3 wishes \(1 for an artifact\)\./);
    assert.match(lines, /You have violated the special Sokoban rules once\./);
    assert.match(lines, /You have entered Sokoban\./);
    assert.match(lines, /You have entered a shop\./);
});

// C insight.c:show_achievements(): the Amulet's present tense is always
// "have"/"have obtained"; "delivered" is the past tense for an ascension.
void test('#conduct keeps the Amulet present tense independent of ascension', () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.u.uachieved = [ACH_AMUL];
    game.u.uhave = { amulet: false };
    game.u.uevent = { ascended: true };

    const lines = currentConductLines().join('\n');

    assert.match(lines, /You have obtained the Amulet of Yendor\./);
    assert.doesNotMatch(lines, /delivered/);
});
