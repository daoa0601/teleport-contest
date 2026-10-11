import test from 'node:test';
import assert from 'node:assert/strict';

import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { DB_ICE, DRAWBRIDGE_UP, DUST, MARK } from '../js/const.js';
import { engravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, MAGIC_MARKER, POT_HEALING, WAN_LIGHT } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

void test('fatal light while engraving ends the command before asking for writing', async () => {
    freshObjectRoom({
        flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
    });
    requireFixtureGame(game);
    installPolymorphedHero('gremlin', { hitPoints: 1, unchanging: true });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const wand = await addInventoryObject(WAN_LIGHT, { spe: 3 });
    const input = resetInputState();
    input.feed(wand.invlet);
    installPagerInput(input, { expected: /light|die|points|Goodbye/i, limit: 20 });

    await rhack('E'.charCodeAt(0));

    assert.equal(game.program_state.gameover, true);
    assert.equal(wand.spe, 2);
    assert.equal(game._occupation ?? null, null);
    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level), null);
});

for (const blind of [false, true]) {
    void test(blind ? 'a blind writer leaves an unseen wand unidentified'
        : 'a sighted writer observes and identifies an unseen light wand', async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        requireFixtureGame(game);
        const wand = await addInventoryObject(WAN_LIGHT, {
            spe: 3, observed: false, dknown: false, known: false, typeKnown: false,
        });
        assert.equal(wand.dknown, false);
        assert.equal(objectTypeKnown(wand), false);
        const input = resetInputState();
        input.feed(wand.invlet);

        await answerPrompts(rhack('E'.charCodeAt(0)), input, [
            { prompt: /You write in the dust with/, keys: ' ' },
            { prompt: /What do you want to write in the dust here\?/, keys: '\x1b' },
        ]);

        assert.equal(wand.dknown, !blind);
        assert.equal(objectTypeKnown(wand), !blind);
        assert.equal(wand.spe, 2);
    });
}

void test('the forced stylus menu can show all objects and return to likely candidates', async () => {
    freshObjectRoom({ flags: { force_invmenu: true } });
    requireFixtureGame(game);
    await addInventoryObject(DAGGER);
    const potion = await addInventoryObject(POT_HEALING);
    const input = resetInputState();

    await answerPrompts(rhack('E'.charCodeAt(0)), input, [
        { prompt: /\(list everything\)/, keys: '*' },
        { prompt: /Potions[\s\S]*\(list likely candidates\)/, keys: '?' },
        { prompt: /\(list everything\)/, keys: '*' },
        { prompt: /Potions[\s\S]*\(list likely candidates\)/, keys: potion.invlet },
        { prompt: /You write in the dust with/, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: '\x1b' },
    ]);

    assert.equal(game._occupation ?? null, null);
    assert.match(game._last_message, /Never mind\./);
});

void test('a raised drawbridge permits writing on the ice beneath it', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const square = game.level.requireAt(game.u.ux, game.u.uy);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_ICE;
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: '-' },
        { prompt: /You write in the frost with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the frost here\?/, keys: 'X\r' },
    ]);
    await moveloop_core();

    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level)?.engr_type, DUST);
    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level)?.text, 'X');
});

void test('writing preserves high-bit tty characters and non-space whitespace', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const marker = await addInventoryObject(MAGIC_MARKER, { spe: 30 });
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: marker.invlet },
        { prompt: /You scribble on the floor with/, keys: ' ' },
        { prompt: /What do you want to scribble on the floor here\?/, keys: '\u00a0\u00e9\u0080\u00ff\u00a0\r' },
    ]);
    assert.ok(game._occupation, 'accepted writing must start an engraving');
    await moveloop_core();

    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.equal(engraving?.engr_type, MARK);
    assert.equal(engraving?.text, '\u00a0\u00e9\u0080\u00ff\u00a0');
});

void test('an owlbear writes with a fingertip', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    installPolymorphedHero('owlbear');
    input.feed('E');

    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: '-' },
        { prompt: /You write in the dust with your fingertip\./, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'X\r' },
    ]);
    await moveloop_core();

    assert.equal(engravingAt(game.u.ux, game.u.uy, game.level)?.text, 'X');
});

void test('a unique native autocomplete entry completes the tip command', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const input = resetInputState();
    input.feed('ti');

    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /# tip/, keys: '\x1b\x1b' },
    ]);

    assert.equal(game.context.move, 0);
});

void test('wizard-only commands do not autocomplete in ordinary play', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const input = resetInputState();
    input.feed('le');

    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /# le\s/, keys: '\x1b\x1b' },
    ]);
});
