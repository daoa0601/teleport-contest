import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { DUST, ENGRAVE, FOUNTAIN, GRAVE, MARK } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { APPLE, DAGGER, MAGIC_MARKER, TOWEL, WAN_DIGGING } from '../js/object_data.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';

// The full fingers-in-dust transaction of the example sessions: the E key
// opens the writing prompt, '-' selects the fingertip, and the engraved
// text lands as a readable dust message.
void test('the E key engraves a dust message with the fingertip', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- or \?\*\]/, keys: '-' },
        { prompt: /You write in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'Elbereth\r' },
    ]);
    // The engraving itself runs as the occupation on the next scheduler pass.
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving, 'engraving the dust message must leave an engraving');
    assert.equal(engraving.text, 'Elbereth');
    assert.equal(engraving.engr_type, DUST);
    assert.ok(engraving.eread);
    assert.ok(engraving.erevealed);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game._occupation, null);
});

// C extcmdlist[] maps "engrave" to doengrave(); typing the extended command
// must reach the same handler as the E key binding.
void test('#engrave as a typed extended command reaches the engrave handler', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);

    input.feed('#engrave\r');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- or \?\*\]/, keys: '-' },
        { prompt: /You write in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'Elbereth\r' },
    ]);
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.text, 'Elbereth');
    assert.equal(engraving.engr_type, DUST);
});

// C doengrave(): an escaped writing prompt leaves nothing behind.
void test('escaping the writing prompt leaves no engraving', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);

    input.feed('E-');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /You write in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: '\x1b' },
    ]);

    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level), null);
    assert.equal(game.u.uconduct.literate ?? 0, 0);
    assert.equal(game.context.move, 0);
    assert.match(game._last_message, /Never mind\./);
});

// C u_can_engrave() rejects the fountain square before any prompt.
void test('a fountain square refuses the engrave command', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;

    await rhack('E'.charCodeAt(0));

    assert.match(game._pending_message, /can't write on the fountain!/);
    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level), null);
    assert.equal(game.context.move, 0);
});

// C doengrave(): a bare finger on a grave only smudges the headstone.
void test('a fingertip on a grave only smudges the surface', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = GRAVE;

    pushKeys('-');
    await rhack('E'.charCodeAt(0));

    assert.match(game._pending_message, /would only make a small smudge/);
    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level), null);
});

// C doengrave_sfx_item(): a towel wipes an existing dust message instead of
// writing, and the command ends having spent the turn without new text.
void test('a towel wipes the dust message instead of engraving', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'X', null, 0, DUST);
    const towel = await addInventoryObject(TOWEL, { spe: 0 });
    assert.ok(towel.invlet);

    pushKeys(towel.invlet);
    await rhack('E'.charCodeAt(0));

    assert.match(game._pending_message, /You wipe out the message here\./);
    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level), null);
    assert.equal(game.context.move, 1);
});

// C engrave(): carving with a bladed weapon is slow (one character per
// action) and dulls the blade until it is too dull to continue.
void test('a dagger carves slowly and dulls to a stop', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const dagger = await addInventoryWeapon(DAGGER, { known: true });
    assert.ok(dagger.invlet);
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- . or \?\*\]/, keys: dagger.invlet },
        { prompt: /You engrave in the floor with/, keys: ' ' },
        { prompt: /What do you want to engrave in the floor here\?/, keys: 'Elberethxxxxxxxx\r' },
    ]);
    let guard = 0;
    while (game._occupation && guard++ < 40) await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, ENGRAVE);
    // The blade dulled to -3, which stops the carving after seven characters.
    assert.equal(dagger.spe, -3);
    assert.equal(engraving.text, 'Elberet');
    assert.match(game._last_message, /cannot write any more\./);
});

// C doengrave_sfx_item(): a charged magic marker scribbles graffiti and
// spends half of the engraved characters as ink.
void test('a magic marker scribbles graffiti and spends ink', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 30 });
    assert.ok(marker.invlet);
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- . or \?\*\]/, keys: marker.invlet },
        { prompt: /You scribble on the floor with/, keys: ' ' },
        { prompt: /What do you want to scribble on the floor here\?/, keys: 'Elbereth\r' },
    ]);
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, MARK);
    assert.equal(engraving.text, 'Elbereth');
    assert.equal(marker.spe, 25);
});

// C doengrave(): when the dust types match, the writer may append to the
// existing message rather than replacing it.
void test('answering the add prompt appends to an existing dust message', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'Elb', null, 0, DUST);

    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\? \[- or \?\*\]/, keys: '-' },
        { prompt: /Do you want to add to the current engraving\? \[ynq\] \(y\) /, keys: 'y' },
        { prompt: /You add to the writing in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to add to the writing in the dust here\?/, keys: 'Ereth\r' },
    ]);
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.text, 'ElbEreth');
    assert.equal(engraving.engr_type, DUST);
});

// The writing prompt suggests implements — weapons, wands, gems, rings,
// towels, and markers — plus the bare hand, and downplays the rest.
void test('the writing prompt suggests implements and the fingertip', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const dagger = await addInventoryWeapon(DAGGER);
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 3 });
    await addInventoryObject(APPLE);
    assert.ok(dagger.invlet && wand.invlet);
    const letters = [dagger.invlet, wand.invlet].sort().join('');
    const input = resetInputState();
    const expectedPrompt = `What do you want to write with? [- ${letters} or ?*] `;
    const promptPattern = new RegExp(expectedPrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    await answerPrompts(
        (async () => { await rhack('E'.charCodeAt(0)); })(),
        input,
        [{ prompt: promptPattern, keys: '\x1b' }],
    );
    assert.match(game._last_message, /Never mind\./);
});

// C extcmdlist[] maps both "call" and "name" onto docallcmd(); the typed
// extended command must not report an unknown command.
void test('#call opens the naming command like #name', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);

    input.feed('#call\r\x1b');
    await moveloop_core();

    assert.doesNotMatch(game._last_message, /unknown extended command/);
});
