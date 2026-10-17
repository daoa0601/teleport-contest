import assert from 'node:assert/strict';
import test from 'node:test';
import { reportHeroEncumbrance } from '../js/attrib.js';
import { rhack } from '../js/cmd.js';
import { flipCoin } from '../js/coin_flip.js';
import { AIR, DOOR, D_BROKEN, HUNGRY, NOT_HUNGRY, WATER, WEAK } from '../js/const.js';
import { clearMessageWindow, cmapSymbolAppearance, flush_screen, newsym } from '../js/display.js';
import { moveElementalBubbles } from '../js/elemental.js';
import { doextversion } from '../js/extversion.js';
import { game, resetGame, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { updateHeroHunger } from '../js/hunger.js';
import { rndmonstAdj } from '../js/mklev.js';
import { beginMealMimicry } from '../js/meal_mimic.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { reportMonsterCombatNoise } from '../js/monster_combat_messages.js';
import { BOULDER, CLUB, DAGGER, GOLD_PIECE, STETHOSCOPE } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { applyInventoryObject } from './support/commands.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
import { requireScreenCell } from './support/screen.js';
function dismissMessages() {
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        assert.ok(++reads < 30, `Unexpected prompt: ${game._pending_message}`);
        input.feed(' ');
    };
}
void test('the first push after a restore describes the effort again', async () => {
    freshObjectRoom({ flags: { verbose: true, pickup: false } });
    dismissMessages();
    await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /With great effort you move the boulder\./);
    game.moves++;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 12);
    assert.match(game._pending_message, /With great effort you move the boulder\./);
});
for (const distant of [false, true]) {
    void test(`restoring allows ${distant ? 'distant' : 'nearby'} monster combat to be heard again`, async () => {
        freshObjectRoom({ moves: distant ? 1 : 40 });
        dismissMessages();
        const monster = await createMonsterAt('newt', distant ? 15 : 11, 10);
        // The distance flag itself admits the first distant noise on turn 1.
        await reportMonsterCombatNoise(monster, game);
        const message = distant ? 'You hear some noises in the distance.' : 'You hear some noises.';
        assert.equal(game._pending_message, message);
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame(game.plname, storage), true);
        clearMessageWindow();
        const restored = game.level?.monsters[0];
        assert.ok(restored);
        await reportMonsterCombatNoise(restored, game);
        assert.equal(game._pending_message, message);
    });
}
void test('inventory letter assignment starts at the first free letter after restore', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER, { invlet: 'z' });
    // Earlier acquisitions used the intervening letters and were consumed.
    game._lastInvNr = 25;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const club = await addInventoryObject(CLUB);
    assert.equal(club.invlet, 'a');
});
void test('a broken doorway is described again after restore', async () => {
    const level = freshObjectRoom({ flags: { mention_decor: true, pickup: false } });
    const door = level.requireAt(10, 10);
    door.typ = DOOR;
    door.doormask = D_BROKEN;
    await autopickupAtHero();
    assert.equal(game._pending_message, 'There is a broken door here.');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await autopickupAtHero();
    assert.equal(game._pending_message, 'There is a broken door here.');
});
void test('restore repeats the load warning for an already burdened hero', async () => {
    freshObjectRoom();
    dismissMessages();
    await addInventoryObject(BOULDER);
    await reportHeroEncumbrance();
    const warning = game._pending_message;
    assert.match(warning, /load/);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await reportHeroEncumbrance();
    assert.equal(game._pending_message, warning);
});
void test('restore recalculates the action sequence before a stethoscope is reused', async () => {
    freshObjectRoom();
    const stethoscope = await addInventoryObject(STETHOSCOPE);
    game._heroActionSeq = game.moves * 8 + 3;
    await applyInventoryObject(stethoscope, '.');
    assert.equal(game.context.move, 0);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await applyInventoryObject(stethoscope.invlet, '.');
    assert.equal(game.context.move, 0, 'the saved fast-action sequence differs from moves * 8');
});
void test('restore retains stethoscope use when it occurred at the base action sequence', async () => {
    freshObjectRoom();
    const stethoscope = await addInventoryObject(STETHOSCOPE);
    game._heroActionSeq = game.moves * 8;
    await applyInventoryObject(stethoscope, '.');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await applyInventoryObject(stethoscope.invlet, '.');
    assert.equal(game.context.move, 1, 'context.stethoscope_seq is saved natively');
});
void test('restored overlapping bubbles collect their contents in the initial traversal direction', async () => {
    const level = freshObjectRoom({ heroX: 20, left: 1, right: 78 });
    requirePlayingGame(game);
    game.water_level = createSpecialLevel({ ...game.u.uz });
    level.elementalBubbles = [
        { x: 20, y: 10, dx: -1, dy: 0, width: 1, height: 1, rows: [1] },
        { x: 20, y: 10, dx: 1, dy: 0, width: 1, height: 1, rows: [1] },
    ];
    for (const column of level.locations)
        for (const cell of column)
            cell.typ = WATER;
    level.requireAt(20, 10).typ = AIR;
    game._bubbleTraversalUp = true;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    initRng(1n);
    await moveElementalBubbles();
    assert.equal(game.u.ux, 21, 'the last bubble in the chain picks up the hero first');
});
void test('restore forgets an alignment cached before a zero-time level change', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const first = createSpecialLevel({ dnum: 0, dlevel: 8, alignment: 1 });
    const second = createSpecialLevel({ dnum: 0, dlevel: 9, alignment: -1 });
    game.specialLevels = new Map([['first', first], ['second', second]]);
    rndmonstAdj();
    game.u.uz.dlevel = 9;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    // A new turn refreshes align_shift()'s cache without changing this level.
    game.moves++;
    initRng(481n);
    const expected = Array.from({ length: 20 }, () => rndmonstAdj());
    assert.equal(restoreGame(game.plname, storage), true);
    initRng(481n);
    const selected = Array.from({ length: 20 }, () => rndmonstAdj());
    assert.deepEqual(selected, expected);
});
void test('the first version query after restore affects a later coin flip as in a new process', async () => {
    freshObjectRoom();
    dismissMessages();
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    pushKeys('  ');
    await doextversion();
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const purse = game.inventory.find(object => object.otyp === GOLD_PIECE);
    assert.ok(purse);
    // C's first version lookup loads nhlib.lua, whose setup shares the gameplay RNG.
    initRng(1n);
    pushKeys('  ');
    await doextversion();
    await flipCoin(purse);
    assert.equal(game._pending_message, 'You flip a gold piece.  It comes up tails.');
});
void test('restored map symbols use the current process symbol set', async () => {
    freshObjectRoom();
    game.symset = 'DECgraphics';
    const storage = memoryStorage();
    const name = game.plname;
    assert.equal(await saveGame(storage), true);
    resetGame();
    game.symset = null;
    assert.equal(restoreGame(name, storage), true);
    assert.deepEqual(cmapSymbolAppearance(CmapSymbol.vwall), { ch: '|', dec: false });
});
for (const recovery of ['paralysis', 'prayer', 'digestion', 'mimicry']) {
    void test(`a restored emergency save does not resume the unsaved ${recovery} delay`, async () => {
        freshObjectRoom({ flags: { tutorial: false, pickup: false } });
        game.plname = 'Interrupted';
        game.u.umovement = 12;
        game._helplessTurns = 4;
        game._helplessReason = 'recovering';
        game._helplessDoneMessage = 'The interrupted delay finishes.';
        game.multi = -4;
        if (recovery === 'prayer') {
            game._helplessAfter = 'finish-prayer';
            game._prayerAlignment = 0;
            game._prayerTrouble = 0;
            game._prayerOutcome = 'pleased';
        }
        else if (recovery === 'digestion') {
            game._helplessAfter = 'finish-digestion';
            game._digestedMonsterSpecies = 0;
        }
        else if (recovery === 'mimicry') {
            game._helplessAfter = 'end-mimic-meal';
            game._mimicMealMessage = 'You now prefer mimicking a human again.';
        }
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const restored = await runSegment({
            seed: 901, datetime: '20260913190000', storage, moves: ' l',
            nethackrc: 'OPTIONS=name:Interrupted,!legacy,!tutorial,pettype:none',
        });
        assert.equal(restored.state.u.ux, 11, 'the first command moves instead of waiting out the old delay');
        assert.equal(restored.state.moves, 41, 'restoration does not spend turns finishing the old delay');
    });
}
void test('restoring an interrupted meal forgets its earlier hunger-message state', async () => {
    freshObjectRoom({ hero: { uhunger: 100, uhs: HUNGRY } });
    game.context.hungerStateBeforeMeal = WEAK;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await updateHeroHunger(false);
    assert.equal(game._pending_message, '');
    assert.equal(game.u.uhs, HUNGRY);
});
void test('restore ends the first-bite suppression of hunger warnings', async () => {
    freshObjectRoom({ hero: { uhunger: 100, uhs: NOT_HUNGRY } });
    game.context.forceSaveHungerState = true;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    clearMessageWindow();
    await updateHeroHunger(true);
    assert.match(game._pending_message, /You feel hungry\./);
});
void test('restore redraws a mimicking hero in the saved species instead of the unsaved disguise', async () => {
    freshObjectRoom();
    dismissMessages();
    await beginMealMimicry(20);
    assert.equal(requireScreenCell(9, 11).ch, '$');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    newsym(10, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(9, 11).ch, '@');
});
//# sourceMappingURL=restore_instance_state.test.js.map