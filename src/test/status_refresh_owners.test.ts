import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { bot, flush_screen } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CLOAK_OF_PROTECTION, SPE_HASTE_SELF } from '../js/object_data.js';
import { getLine } from '../js/query.js';
import { captureRunmodeDelay } from '../js/runmode.js';
import { castSpell } from '../js/spell.js';
import { Terminal } from '../js/terminal.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshCasterRoom } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { learnSpell } from './support/spells.js';

void test('walking run display advances the turn counter', async () => {
    freshObjectRoom({ moves: 1, flags: { time: true, runmode: 'walk' } });
    await bot();
    game.moves = 2;

    await captureRunmodeDelay(game, true, 2);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:2\b/);
});

void test('casting displays its reduced spell power', async () => {
    freshCasterRoom();
    requirePlayingGame(game);
    await learnSpell(SPE_HASTE_SELF);
    await bot();

    await castSpell(SPE_HASTE_SELF);
    await flush_screen(1);

    assert.ok(game.u.uen < game.u.uenmax);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''),
        new RegExp(`Pw:${game.u.uen}\\(${game.u.uenmax}\\)`));
});

void test('instant armor removal retains AC during feedback and updates it at the next hero turn', async () => {
    const input = freshTurnRoom();
    const cloak = await addInventoryObject(CLOAK_OF_PROTECTION);
    wearHeroArmor(cloak);
    findArmorClass();
    await bot();
    input.feed('T.');

    await moveloop_core();
    assert.equal(game.u.uac, 7);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:7\b/);
    await moveloop_core();

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:10\b/);
});

void test('a map flush preserves status rows erased by line input until a status update', async () => {
    freshObjectRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 6, rows: 24 }));
    await bot();
    pushKeys('\n');

    await getLine('Choose '.repeat(18), () => true);
    await flush_screen(1);

    assert.equal(requireScreenRow(22).map(cell => cell.ch).join('').trim(), '');
    assert.equal(requireScreenRow(23).map(cell => cell.ch).join('').trim(), '');
    await bot();
    // The six-column tty shrinks Dlvl to Dl before restoring this row.
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /^Dl:8/);
});

void test('the save sentinel skips status drawing and consumes the redraw request', async () => {
    freshObjectRoom();
    game.u.uhp = 1;
    await bot();
    game.u.uhp = -1;
    game.context.botl = true;

    await flush_screen(1);
    game.u.uhp = 0;
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:1\(40\)/);
});
