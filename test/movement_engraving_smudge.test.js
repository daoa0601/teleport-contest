import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { DUST, HEADSTONE, HOLE, NO_MINVENT, STONE, TELEP_TRAP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('stepping onto a teleport trap smudges the departure and final arrival dust', async () => {
    const level = freshObjectRoom();
    addTrap(level, TELEP_TRAP, 11, 10, { teledest: { x: 13, y: 10 } });
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    makeEngravingAt(11, 10, '?', null, game.moves, DUST);
    makeEngravingAt(13, 10, '?', null, game.moves, DUST);
    pushKeys(' '.repeat(10));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 13);
    assert.equal(game.u.uy, 10);
    assert.equal(engravingAt(10, 10), null);
    assert.equal(engravingAt(11, 10)?.text, '?', 'the trap square is not the final arrival');
    assert.equal(engravingAt(13, 10), null);
});
void test('a teleport back to the departure square still smudges its dust', async () => {
    const level = freshObjectRoom();
    addTrap(level, TELEP_TRAP, 11, 10, { teledest: { x: 10, y: 10 } });
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    pushKeys(' '.repeat(10));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(engravingAt(10, 10), null);
});
void test('resisting a teleport trap still smudges both ends of the step', async () => {
    const level = freshObjectRoom({ hero: { antimagic: true } });
    addTrap(level, TELEP_TRAP, 11, 10);
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    makeEngravingAt(11, 10, '?', null, game.moves, DUST);
    pushKeys(' '.repeat(10));
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(engravingAt(10, 10), null);
    assert.equal(engravingAt(11, 10), null);
});
void test('a deferred hole fall cannot smudge either level from above the shaft', async () => {
    const { source, destination } = freshConnectedLevels();
    addTrap(source, HOLE, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    game.level = destination;
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    game.level = source;
    pushKeys(' '.repeat(20));
    await rhack('l'.charCodeAt(0));
    assert.ok(game.level === source, 'the fall waits until the movement command finishes');
    assert.equal(engravingAt(10, 10, source)?.text, '?');
    assert.equal(engravingAt(10, 10, destination)?.text, '?');
    await finishScheduledLevelChange();
    assert.ok(game.level === destination, 'the scheduled fall reaches the destination');
});
for (const levitating of [false, true]) {
    void test(`walking ${levitating ? 'above' : 'over'} dust respects floor reach and headstones`, async () => {
        freshObjectRoom({ hero: { levitating } });
        makeEngravingAt(10, 10, '?', null, game.moves, DUST);
        makeEngravingAt(11, 10, 'A grave', null, game.moves, HEADSTONE);
        pushKeys(' '.repeat(10));
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 11);
        assert.equal(engravingAt(10, 10)?.text ?? null, levitating ? '?' : null);
        assert.equal(engravingAt(11, 10)?.text, 'A grave');
    });
}
void test('a blocked step leaves departure dust intact', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = STONE;
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(engravingAt(10, 10)?.text, '?');
});
for (const refused of [false, true]) {
    void test(`a ${refused ? 'refused' : 'successful'} pet swap ${refused ? 'preserves' : 'smudges'} departure dust`, async () => {
        freshObjectRoom();
        const pet = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
        initializePet(pet);
        if (refused)
            await floorObject(BOULDER, 10, 10);
        makeEngravingAt(10, 10, '?', null, game.moves, DUST);
        pushKeys(' '.repeat(10));
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, refused ? 10 : 11);
        assert.equal(engravingAt(10, 10)?.text ?? null, refused ? '?' : null);
    });
}
void test('the first running step smudges dust but automatic continuation does not', async () => {
    freshObjectRoom();
    makeEngravingAt(10, 10, '?', null, game.moves, DUST);
    await rhack('L'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(engravingAt(10, 10), null);
    makeEngravingAt(11, 10, '?', null, game.moves, DUST);
    await continueRun();
    assert.equal(game.u.ux, 12);
    assert.equal(engravingAt(11, 10)?.text, '?');
});
//# sourceMappingURL=movement_engraving_smudge.test.js.map