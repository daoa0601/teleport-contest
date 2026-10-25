import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { freshTurnRoom } from './support/playable-room.js';
import { freshObjectRoom } from './support/object-room.js';
import { BURN, DUST, ENGRAVE } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { WAN_CANCELLATION, WAN_COLD, WAN_DIGGING, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_SLEEP, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STRIKING, WAN_TELEPORTATION, } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { objectTypeKnown } from '../js/shk.js';
// C engrave.c doengrave_sfx_item_WAN(): engraving with a wand spends one
// charge, announces the writing implement, and prints the wand's engraving
// message only after the engraving text has been accepted.
void test('a wand of digging carves into the floor and gravel flies up', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const wand = await addInventoryObject(WAN_DIGGING, {
        spe: 3, observed: false, dknown: false, known: false, typeKnown: false,
    });
    assert.ok(wand.invlet);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /This .* is a wand of digging!--More--/, keys: ' ' },
        { prompt: /You engrave in the floor with/, keys: ' ' },
        { prompt: /What do you want to engrave in the floor here\?/, keys: 'Ereth\r' },
    ]);
    // The post-engraving message follows the accepted text.
    assert.equal(game._pending_message, 'Gravel flies up from the floor.');
    assert.equal(wand.spe, 2, 'engraving spends one charge');
    // C learnwand() runs after the discovery message; more_experienced(0, 10)
    // grants score for the discovery.
    assert.equal(objectTypeKnown(wand), true);
    assert.equal(game.u.urexp, 10);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, ENGRAVE);
    assert.equal(engraving.text, 'Ereth');
});
// C engrave.c WAN_FIRE: type BURN, and "Flames fly from the wand." arrives
// after the text prompt.
void test('a wand of fire burns the message into the floor', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const wand = await addInventoryObject(WAN_FIRE, { spe: 3 });
    assert.ok(wand.invlet);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /You burn into the floor with/, keys: ' ' },
        { prompt: /What do you want to burn into the floor here\?/, keys: 'Ereth\r' },
    ]);
    assert.equal(game._pending_message, 'Flames fly from the wand.');
    assert.equal(wand.spe, 2);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, BURN);
    assert.equal(engraving.text, 'Ereth');
});
// C engrave.c WAN_LIGHTNING: the sighted writer is blinded by the flash for
// rnd(50) turns while the message still burns into the floor.
void test('a wand of lightning blinds the engraver with a flash', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const wand = await addInventoryObject(WAN_LIGHTNING, { spe: 3 });
    assert.ok(wand.invlet);
    initRng(31n);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /You burn into the floor with/, keys: ' ' },
        { prompt: /What do you want to burn into the floor here\?/, keys: 'Ereth\r' },
    ]);
    assert.match(game._pending_message, /^Lightning arcs from the wand\./);
    assert.match(game._pending_message, /You are blinded by the flash!/);
    assert.ok((game.u.blindTurns ?? 0) >= 1, 'the flash must blind the writer');
    assert.equal(wand.spe, 2);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, BURN);
    assert.equal(engraving.text, 'Ereth');
});
// C engrave.c: dust wands keep the writing in the dust and only add their
// engraving message, spending the charge all the same.
for (const scenario of [
    { name: 'striking', typ: WAN_STRIKING, message: 'The wand unsuccessfully fights your attempt to write!' },
    { name: 'slow monster', typ: WAN_SLOW_MONSTER, message: 'The bugs on the floor slow down!' },
    { name: 'speed monster', typ: WAN_SPEED_MONSTER, message: 'The bugs on the floor speed up!' },
    { name: 'sleep', typ: WAN_SLEEP, message: 'The bugs on the floor stop moving!' },
    { name: 'magic missile', typ: WAN_MAGIC_MISSILE, message: 'The floor is riddled by bullet holes!' },
]) {
    void test(`a wand of ${scenario.name} spends its charge on a dust message`, async () => {
        const input = freshTurnRoom();
        requireFixtureGame(game);
        const wand = await addInventoryObject(scenario.typ, { spe: 3 });
        assert.ok(wand.invlet);
        input.feed('E');
        await answerPrompts(moveloop_core(), input, [
            { prompt: /What do you want to write with\?/, keys: wand.invlet },
            { prompt: /You write in the dust with/, keys: ' ' },
            { prompt: /What do you want to write in the dust here\?/, keys: 'Ereth\r' },
        ]);
        assert.equal(game._pending_message, scenario.message);
        assert.equal(wand.spe, 2);
        await moveloop_core();
        const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
        assert.ok(engraving);
        assert.equal(engraving.engr_type, DUST);
    });
}
// C engrave.c WAN_CANCELLATION: the current engraving vanishes when the
// cancellation begins, and the new text is written over the emptied square.
void test('a wand of cancellation vanishes the current engraving', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'old', null, game.moves, DUST);
    const wand = await addInventoryObject(WAN_CANCELLATION, { spe: 3 });
    assert.ok(wand.invlet);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /The engraving on the floor vanishes!--More--/, keys: ' ' },
        { prompt: /You write in the dust with/, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'Ereth\r' },
    ]);
    assert.equal(wand.spe, 2);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, DUST);
    assert.equal(engraving.text.length, 5, 'the new message replaces the vanished one');
    assert.equal(game.level?.engravings?.filter((entry) => entry.text === 'old').length, 0);
});
// C engrave.c WAN_TELEPORTATION + rloc_engr(): the vanished engraving moves
// somewhere else on the level and loses its read flags.
void test('a wand of teleportation relocates the current engraving', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    const old = makeEngravingAt(game.u.ux, game.u.uy, 'old', null, game.moves, DUST);
    assert.ok(old);
    old.eread = true;
    old.erevealed = true;
    const wand = await addInventoryObject(WAN_TELEPORTATION, { spe: 3 });
    assert.ok(wand.invlet);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /The engraving on the floor vanishes!--More--/, keys: ' ' },
        { prompt: /You write in the dust with/, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'Ereth\r' },
    ]);
    assert.equal(wand.spe, 2);
    const moved = game.level?.engravings?.find((entry) => entry.text === 'old');
    assert.ok(moved, 'the vanished engraving must still exist somewhere');
    assert.ok(moved.x !== game.u.ux || moved.y !== game.u.uy, 'the engraving must no longer sit under the hero');
    assert.equal(moved.eread, false);
    assert.equal(moved.erevealed, false);
});
// C engrave.c WAN_COLD: a burned engraving is frozen out immediately, while
// the ice cubes message waits until the engraving text has been accepted.
void test('a wand of cold freezes out a burned engraving', async () => {
    const input = freshTurnRoom();
    requireFixtureGame(game);
    makeEngravingAt(game.u.ux, game.u.uy, 'old', null, game.moves, BURN);
    const wand = await addInventoryObject(WAN_COLD, { spe: 3 });
    assert.ok(wand.invlet);
    input.feed('E');
    await answerPrompts(moveloop_core(), input, [
        { prompt: /What do you want to write with\?/, keys: wand.invlet },
        { prompt: /The engraving on the floor vanishes!--More--/, keys: ' ' },
        { prompt: /You write in the dust with/, keys: ' ' },
        { prompt: /What do you want to write in the dust here\?/, keys: 'Ereth\r' },
    ]);
    assert.equal(game._pending_message, 'A few ice cubes drop from the wand.');
    assert.equal(wand.spe, 2);
    await moveloop_core();
    const engraving = engravingAt(game.u.ux, game.u.uy, game.level);
    assert.ok(engraving);
    assert.equal(engraving.engr_type, DUST);
    assert.equal(game.level?.engravings?.filter((entry) => entry.text === 'old').length, 0);
});
// C engrave.c zappable() else-branch: a worn-out wand that fails to yield a
// wrested charge reports the fact and still spends the turn.
void test('a worn-out wand is too dry to engrave', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 0 });
    assert.ok(wand.invlet);
    const input = resetInputState();
    initRng(9n); /* rn2(WAND_WREST_CHANCE) != 0: no wrested charge */
    input.feed(wand.invlet);
    await rhack('E'.charCodeAt(0));
    assert.equal(game._pending_message, 'The wand is too worn out to engrave.');
    assert.equal(wand.spe, 0, 'the failed wrest consumes no charge');
    assert.equal(game.inventory.includes(wand), true);
    assert.equal(game.context.move, 1);
    assert.equal(game._occupation ?? null, null);
});
//# sourceMappingURL=engrave_wand_effects.test.js.map