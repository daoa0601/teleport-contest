import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { BEAR_TRAP, LANDMINE, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { BEARTRAP, BOULDER, DAGGER, LAND_MINE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { applyInventoryObject, dropInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
const trapTools = [[LAND_MINE, LANDMINE], [BEARTRAP, BEAR_TRAP]];
for (const [objectType, trapType] of trapTools) {
    void test(`apply arms a carried ${objectType === LAND_MINE ? 'land mine' : 'bear trap'} through its occupation`, async () => {
        const level = freshPlayableRoom({ hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
        const object = await addInventoryObject(objectType, { quan: 2 });
        await applyInventoryObject(object);
        assert.equal(game.context.move, 1);
        assert.match(game._pending_message, /begin setting/);
        pushKeys('     ');
        for (let turn = 0; turn < 8 && game._occupation; turn++)
            await continueCountedCommand();
        const trap = level.traps.find(candidate => candidate.tx === game.u.ux && candidate.ty === game.u.uy);
        assert.ok(trap);
        assert.equal(trap.ttyp, trapType);
        assert.equal(trap.madeby_u, true);
        assert.equal(trap.tseen, true);
        assert.equal(object.quan, 1);
        assert.equal(game._occupation, null);
    });
}
void test('trap setting can resume after an interruption on the same square', async () => {
    freshPlayableRoom();
    const mine = await addInventoryObject(LAND_MINE);
    await applyInventoryObject(mine);
    await stopHeroOccupation();
    resetInputState();
    await applyInventoryObject(mine, ' ');
    assert.match(game._pending_message, /resume setting/);
    assert.ok(game._occupation);
    assert.equal(mine.where, 'inventory');
});
void test('walking away from an interrupted trap discards progress even after returning', async () => {
    const level = freshPlayableRoom({ hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const mine = await addInventoryObject(LAND_MINE);
    await applyInventoryObject(mine);
    await continueCountedCommand();
    await stopHeroOccupation();
    resetInputState();
    await rhack('l'.charCodeAt(0));
    await rhack('h'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    await applyInventoryObject(mine, ' ');
    assert.match(game._pending_message, /begin setting/);
    await continueCountedCommand();
    assert.equal(level.traps.length, 0, 'returning must require the full preparation time');
    assert.equal(mine.where, 'inventory');
    await continueCountedCommand();
    assert.equal(level.traps.length, 1);
    assert.equal(mine.where, 'gone');
});
void test('dropping another item discards interrupted trap preparation', async () => {
    const level = freshPlayableRoom({ hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const mine = await addInventoryObject(LAND_MINE);
    const dagger = await addInventoryObject(DAGGER);
    await runExtendedCommand('apply', mine.invlet);
    await continueCountedCommand();
    await stopHeroOccupation();
    resetInputState();
    await dropInventoryObject(dagger);
    await runExtendedCommand('apply', mine.invlet);
    await continueCountedCommand();
    assert.equal(dagger.where, 'floor');
    assert.equal(level.traps.length, 0, 'dropping must require the full preparation time again');
    assert.equal(mine.where, 'inventory');
    await continueCountedCommand();
    assert.equal(level.traps.length, 1);
    assert.equal(mine.where, 'gone');
});
void test('a refused pet swap discards interrupted trap preparation', async () => {
    const level = freshPlayableRoom({ hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const mine = await addInventoryObject(LAND_MINE);
    await floorObject(BOULDER, 10, 10);
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    initializePet(kitten);
    await runExtendedCommand('apply', mine.invlet);
    await continueCountedCommand();
    await stopHeroOccupation();
    resetInputState();
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /doesn't want to swap places/);
    assert.equal(game.u.ux, 10);
    assert.equal(kitten.mx, 11);
    assert.equal(game.context.move, 1);
    await runExtendedCommand('apply', `${mine.invlet} `);
    await continueCountedCommand();
    assert.equal(level.traps.length, 0, 'a refused swap must require the full preparation time again');
    assert.equal(mine.where, 'inventory');
    await continueCountedCommand();
    assert.equal(level.traps.length, 1);
    assert.equal(mine.where, 'gone');
});
void test('a stunned hero cannot set a trap but the attempt still takes a turn', async () => {
    freshPlayableRoom({ hero: { stunned: true, stunnedTurns: 12 } });
    const mine = await addInventoryObject(LAND_MINE);
    await applyInventoryObject(mine);
    assert.equal(game._pending_message, "You can't set a trap while stunned!");
    assert.equal(game.context.move, 1);
    assert.equal(game._occupation ?? null, null);
    assert.equal(mine.where, 'inventory');
});
void test('blindness doubles the time needed to arm a land mine', async () => {
    const durations = [];
    for (const blind of [false, true]) {
        freshPlayableRoom({ hero: { permaBlind: blind, acurr: { a: [18, 10, 10, 18, 10, 10] } } });
        const mine = await addInventoryObject(LAND_MINE);
        await applyInventoryObject(mine);
        pushKeys('     ');
        let turns = 0;
        while (game._occupation && turns < 12) {
            await continueCountedCommand();
            turns++;
        }
        durations.push(turns);
    }
    const ordinary = durations[0];
    assert.ok(ordinary && ordinary > 0, 'arming a mine must take time');
    assert.equal(durations[1], 2 * ordinary);
});
void test('an unskilled rider drops a beartrap when the setting attempt bungles', async () => {
    freshPlayableRoom();
    const pony = await createSaddledSteed();
    game.u.usteed = pony;
    pony.mx = game.u.ux;
    pony.my = game.u.uy;
    const beartrap = await addInventoryObject(BEARTRAP, { cursed: true });
    const input = resetInputState();
    let reads = 0;
    input.display = { async readKey() {
            assert.ok(++reads < 12, `Trap setting did not finish: ${game._pending_message}`);
            return (game._pending_message.includes('Continue your attempt') ? 'y' : ' ').charCodeAt(0);
        } };
    initRng(4n);
    await applyInventoryObject(beartrap);
    assert.equal(beartrap.where, 'floor');
    assert.equal(game._occupation ?? null, null);
    assert.equal(game.context.move, 1);
});
void test('switching traps after an interrupted mounted bungle activates the replacement trap', async () => {
    freshPlayableRoom({ hero: { acurr: { a: [18, 10, 10, 18, 10, 10] } } });
    const pony = await createSaddledSteed();
    game.u.usteed = pony;
    pony.mx = game.u.ux;
    pony.my = game.u.uy;
    const mine = await addInventoryObject(LAND_MINE, { cursed: true });
    const beartrap = await addInventoryObject(BEARTRAP);
    const startingHp = pony.mhp;
    let reads = 0;
    resetInputState().display = { async readKey() {
            assert.ok(++reads < 20, `Trap switching did not finish: ${game._pending_message}`);
            return (game._pending_message.includes('Continue your attempt') ? 'y' : ' ').charCodeAt(0);
        } };
    initRng(4n);
    await runExtendedCommand('apply', mine.invlet);
    await stopHeroOccupation();
    initRng(1n);
    await runExtendedCommand('apply', beartrap.invlet);
    for (let turn = 0; turn < 8 && game._occupation; turn++)
        await continueCountedCommand();
    assert.equal(beartrap.where, 'gone');
    assert.equal(mine.where, 'inventory');
    assert.ok((game.u.utrap ?? 0) > 0, 'the replacement bear trap must close on the steed');
    assert.ok(pony.mhp < startingHp, 'the replacement trap must injure the steed');
});
//# sourceMappingURL=trap_setting_apply.test.js.map