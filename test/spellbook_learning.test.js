import { requirePlayingGame } from '../js/gstate.js';
import test, {} from 'node:test';
import { planInput } from './support/planned-input.js';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { A_INT, A_WIS, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { resetInputState } from '../js/input.js';
import { curseObject } from '../js/object_state.js';
import { deleteObject } from '../js/object_delete.js';
import { cancelObjectMagic } from '../js/object_cancellation.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { wearEyewear } from '../js/eyewear.js';
import { SPE_LIGHT, SPE_FIREBALL, SPE_FINGER_OF_DEATH, SPE_BLANK_PAPER, LENSES, GOLD_PIECE, SACK, OBJECT_DELAY } from '../js/object_data.js';
import { forceLearnSpell } from '../js/spell.js';
import { currentSpellKnowledge } from '../js/spell_casting_rules.js';
import { studyBook, continueSpellbookStudy, cursedBook } from '../js/spellbook_study.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addShopObjectToBill } from '../js/shk.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createStaffedShop } from './support/shop.js';
function occupationKey() { return game._occupation?.key; }
async function book(type = SPE_LIGHT, properties = {}) {
    const object = await addInventoryObject(type, { initialize: false, blessed: true, ...properties });
    assert.ok(game.objectDescriptions != null, 'Expected game.objectDescriptions to be initialized');
    game.objectDescriptions[type] = 'vellum';
    return object;
}
function acknowledge(t, answers = []) {
    const input = resetInputState();
    planInput(input, t, answers);
    return input;
}
async function finishStudy() {
    for (let turn = 0; turn < 1000; turn++) {
        if (!await continueSpellbookStudy()) {
            game._occupation = null;
            return;
        }
    }
    assert.fail('spellbook occupation did not complete within its native maximum delay');
}
void test('learning installs the native delay and completes only after the final occupation call', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book();
    const result = await studyBook(source);
    assert.equal(result.spentTime, true);
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    assert.equal(game.context.spbook.book, source);
    assert.equal(game.context.spbook.o_id, source.o_id);
    const delay = OBJECT_DELAY[SPE_LIGHT];
    assert.ok(delay !== undefined);
    assert.equal(game.context.spbook.delay, -delay);
    assert.equal(source.in_use, false);
    assert.ok(game._occupation != null, 'Expected game._occupation to be initialized');
    assert.equal(occupationKey(), 'study-book');
    for (let turn = 0; turn < delay; turn++) {
        assert.equal(await continueSpellbookStudy(), true);
        assert.equal((game.spells || []).length, 0);
    }
    acknowledge(t);
    assert.equal(await continueSpellbookStudy(), false);
    assert.ok(game.spells[0] != null);
    assert.equal(game.spells[0].otyp, SPE_LIGHT);
    assert.equal(currentSpellKnowledge(game.spells[0]), 20001);
    assert.equal(source.spestudied, 1);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SPE_LIGHT), true);
    assert.equal(game.context.spbook.book, null);
    assert.equal(game.inventory.includes(source), true);
});
void test('an interrupted book resumes its remaining work without another admission roll', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book(SPE_FIREBALL);
    await studyBook(source);
    await continueSpellbookStudy();
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    const remaining = game.context.spbook.delay;
    acknowledge(t, [
        { prompt: /begin to memorize.*stop studying/, keys: ' ' },
    ]);
    await stopHeroOccupation();
    assert.equal(game._occupation, null);
    source.blessed = false;
    game.u.acurr.a[A_INT] = 3;
    const resumed = await studyBook(source);
    assert.equal(resumed.spentTime, true);
    assert.equal(game.context.spbook.delay, remaining);
    assert.ok(game._occupation != null, 'Expected game._occupation to be initialized');
    assert.equal(occupationKey(), 'study-book');
    assert.match(game._pending_message, /continue your efforts to memorize/);
});
void test('saving an interrupted study restores the actual inventory book and remaining delay', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Reader';
    const source = await book(SPE_FIREBALL);
    await studyBook(source);
    await continueSpellbookStudy();
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    const remaining = game.context.spbook.delay;
    acknowledge(t, [
        { prompt: /begin to memorize.*stop studying/, keys: ' ' },
    ]);
    await stopHeroOccupation();
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Reader', storage), true);
    const restored = game.inventory.find(object => object.o_id === source.o_id);
    assert.equal(game.context.spbook.book, restored);
    assert.ok(restored != null, 'Expected restored to be initialized');
    assert.equal(game.context.spbook.o_id, restored.o_id);
    assert.equal(game.context.spbook.delay, remaining);
    await studyBook(restored);
    assert.equal(game.context.spbook.delay, remaining);
});
void test('the live destruction owner clears retained study identity', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book();
    await studyBook(source);
    acknowledge(t);
    await stopHeroOccupation();
    await deleteObject(source);
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    assert.equal(game.context.spbook.book, null);
    assert.equal(game.context.spbook.o_id, 0);
    assert.equal(source.where, 'gone');
});
void test('cancelling an interrupted book to blank prevents resumption and discovers blank paper', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book(SPE_FIREBALL);
    await studyBook(source);
    acknowledge(t, [
        { prompt: /begin to memorize.*stop studying/, keys: ' ' },
    ]);
    await stopHeroOccupation();
    await cancelObjectMagic(source);
    assert.equal(source.otyp, SPE_BLANK_PAPER);
    const result = await studyBook(source);
    assert.equal(result.spentTime, true);
    assert.equal(game._occupation, null);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SPE_BLANK_PAPER), true);
    assert.match(game._pending_message, /all blank/);
});
void test('a newly cursed active book slams shut before study can resume', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book();
    await studyBook(source);
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    const remaining = game.context.spbook.delay;
    const input = resetInputState();
    const cursing = curseObject(source);
    await input.waitUntilBlocked();
    assert.equal(source.cursed, true);
    assert.ok(game._occupation != null, 'Expected game._occupation to be initialized');
    assert.equal(occupationKey(), 'study-book');
    assert.match(game._pending_message, /begin to memorize.*slams shut/);
    input.feed(' ');
    await cursing;
    assert.equal(game._occupation, null);
    assert.equal(source.bknown, true);
    assert.equal(game.context.spbook.delay, remaining);
    assert.equal(game._pending_message, 'You stop studying.');
});
void test('declining to reread a known spell spends no turn and leaves its question at the next command', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book();
    forceLearnSpell(SPE_LIGHT);
    const input = resetInputState();
    const moves = game.moves;
    input.feed(source.invlet);
    const reading = rhack('r'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'You know "light" quite well already.');
    assert.equal(game._occupation, undefined);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /^Refresh your memory anyway/);
    input.feed('n');
    await reading;
    assert.equal(game.context.move, 0);
    assert.equal(game.moves, moves);
    assert.equal(source.spestudied || 0, 0);
    assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(SPE_LIGHT), true);
    const nextCommand = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Refresh your memory anyway? [yn] (n)');
    }
    finally {
        input.feed('\x1b');
        await nextCommand;
    }
});
void test('a Wizard can decline a difficult uncursed book after the native ability warning', async (t) => {
    freshObjectRoom({ role: 'wizard', hero: { ulevel: 1 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_INT] = 3;
    const source = await book(SPE_FINGER_OF_DEATH, { blessed: false });
    const input = resetInputState();
    const studying = studyBook(source);
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /very difficult to comprehend/);
    assert.equal(source.in_use, true);
    input.feed('n');
    const result = await studying;
    assert.equal(result.spentTime, true);
    assert.equal(source.in_use, false);
    assert.ok(!game._occupation);
    assert.equal(game._helplessTurns || 0, 0);
});
void test('lenses accelerate actual study without changing the spell or book identity', async (t) => {
    const elapsed = [];
    for (const lenses of [false, true]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const source = await book(SPE_FIREBALL);
        if (lenses)
            await wearEyewear(await addInventoryObject(LENSES));
        acknowledge(t, lenses ? [{ prompt: /wearing a pair of lenses/, keys: ' ' }] : []);
        await studyBook(source);
        initRng(4n);
        let turns = 0;
        while (await continueSpellbookStudy())
            turns++;
        elapsed.push(turns);
        assert.ok(game.spells[0] != null);
        assert.equal(game.spells[0].otyp, SPE_FIREBALL);
        assert.equal(source.spestudied, 1);
    }
    assert.ok(elapsed[0] !== undefined && elapsed[1] !== undefined);
    assert.ok(elapsed[1] < elapsed[0]);
});
for (const [remembered, studied, expectedBlank] of [[false, 2, false], [false, 3, true], [true, 3, false], [true, 4, true]]) {
    void test(`${remembered ? 'refreshing' : 'learning'} a book studied ${studied} times follows the native fading threshold`, async (t) => {
        freshObjectRoom();
        requirePlayingGame(game);
        const source = await book(SPE_LIGHT, { spestudied: studied });
        if (remembered) {
            forceLearnSpell(SPE_LIGHT);
            assert.ok(game.spells[0] != null);
            game.spells[0].know = 0;
        }
        acknowledge(t, remembered || expectedBlank
            ? [{ prompt: /begin to memorize the runes/, keys: ' ' }] : []);
        await studyBook(source);
        await finishStudy();
        assert.equal(source.otyp === SPE_BLANK_PAPER, expectedBlank);
        if (expectedBlank) {
            assert.ok(source.spestudied != null, 'Expected source.spestudied to be initialized');
            assert.ok(source.spestudied >= 0 && source.spestudied < studied);
            assert.ok(game._knownObjectTypes != null, 'Expected game._knownObjectTypes to be initialized');
            assert.equal(game._knownObjectTypes?.has(SPE_BLANK_PAPER), true);
            assert.equal(game.spells.length, Number(remembered));
        }
        else {
            assert.equal(source.spestudied, studied + 1);
            assert.equal(currentSpellKnowledge(game.spells[0]), 20001);
            if (remembered)
                assert.match(game._pending_message, /knowledge.*restored/);
        }
        assert.equal(game.inventory.includes(source), true);
    });
}
void test('successful shop study accrues its real usage fee while retaining the stock and bill', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const source = await book();
    await addShopObjectToBill(source, game, { ininv: true, silent: true });
    acknowledge(t, [
        { prompt: /begin to memorize.*learn the "light" spell/, keys: ' ' },
    ]);
    await studyBook(source);
    await finishStudy();
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.equal(shopkeeper.eshk.bill.length, 1);
    assert.equal(source.unpaid, true);
    assert.equal(game.inventory.includes(source), true);
});
void test('a dull book puts a low-Wisdom reader to sleep before study is installed', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_WIS] = 3;
    const source = await book();
    assert.ok(game.objectDescriptions != null, 'Expected game.objectDescriptions to be initialized');
    game.objectDescriptions[source.otyp] = 'dull';
    initRng(1n);
    const result = await studyBook(source);
    assert.equal(result.spentTime, true);
    assert.ok(game._helplessTurns != null, 'Expected game._helplessTurns to be initialized');
    assert.ok(game._helplessTurns > 0);
    assert.equal(game._helplessReason, 'sleeping');
    assert.ok(!game._occupation);
    assert.equal(source.spestudied || 0, 0);
});
void test('sleep resistance keeps a dull book studyable', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.acurr.a[A_WIS] = 3;
    const source = await book();
    assert.ok(game.objectDescriptions != null, 'Expected game.objectDescriptions to be initialized');
    game.objectDescriptions[source.otyp] = 'dull';
    grantIntrinsicProperty('sleepResistance', 'outside');
    await studyBook(source);
    assert.ok(game._occupation != null, 'Expected game._occupation to be initialized');
    assert.equal(occupationKey(), 'study-book');
    assert.equal(game._helplessTurns || 0, 0);
});
// Each seed selects one source cursed_book branch for a real level-seven book.
for (const [effect, seed] of [['teleport', 7], ['aggravation', 2], ['blindness', 25], ['gold loss', 14], ['confusion', 9], ['explosion', 6]]) {
    void test(`the cursed book ${effect} branch applies its actual owning effect`, async (t) => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        const source = await book(SPE_FINGER_OF_DEATH, { blessed: false, cursed: true });
        const before = { x: game.u.ux, y: game.u.uy };
        let loose, contained, sleeper;
        if (effect === 'aggravation') {
            sleeper = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
            sleeper.msleeping = 1;
            sleeper.mstrategy = STRAT_WAITFORU;
        }
        if (effect === 'gold loss') {
            loose = await addInventoryObject(GOLD_PIECE, { quan: 50 });
            const sack = await addInventoryObject(SACK);
            contained = await knownObject(GOLD_PIECE, { quan: 75 });
            await addCreatedObjectToContainer(sack, contained);
        }
        initRng(BigInt(seed));
        acknowledge(t, effect === 'teleport'
            ? [{ prompt: /wrenching sensation/, keys: ' ' }] : []);
        const result = await cursedBook(source);
        assert.equal(result.heroDied, false);
        if (effect === 'teleport')
            assert.ok(game.u.ux !== before.x || game.u.uy !== before.y);
        if (effect === 'aggravation') {
            assert.ok(sleeper != null, 'Expected sleeper to be initialized');
            assert.equal(sleeper.msleeping, 0);
            assert.ok(sleeper.mstrategy != null, 'Expected sleeper.mstrategy to be initialized');
            assert.equal(sleeper.mstrategy & STRAT_WAITFORU, 0);
        }
        if (effect === 'blindness') {
            assert.ok(game.u.blindTurns !== undefined);
            assert.ok(game.u.blindTurns >= 250 && game.u.blindTurns < 350);
        }
        if (effect === 'gold loss') {
            assert.ok(loose != null, 'Expected loose to be initialized');
            assert.equal(loose.where, 'gone');
            assert.ok(contained != null, 'Expected contained to be initialized');
            assert.equal(contained.where, 'contained');
        }
        if (effect === 'confusion') {
            assert.ok(game.u.confusionTurns !== undefined);
            assert.ok(game.u.confusionTurns >= 16 && game.u.confusionTurns < 23);
        }
        if (effect === 'explosion') {
            assert.equal(result.destroyed, true);
            assert.ok(game.u.uhp >= 75 && game.u.uhp <= 93);
        }
    });
}
void test('magic resistance shields the reader but an exploding book is still destroyed', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    grantIntrinsicProperty('antimagic', 'outside');
    const source = await book(SPE_FINGER_OF_DEATH, { cursed: true, blessed: false });
    initRng(6n);
    const result = await cursedBook(source);
    assert.equal(result.destroyed, true);
    assert.equal(game.u.uhp, 40);
    assert.match(game._pending_message, /unharmed/);
});
void test('confused first reading tears the real book only after its warning is acknowledged', async (t) => {
    freshObjectRoom({ hero: { confusionTurns: 10 } });
    requirePlayingGame(game);
    const source = await book();
    recordObjectKnowledge(source.otyp);
    initRng(1n); // confused_book's one-in-three destructive branch.
    const input = resetInputState();
    const reading = studyBook(source);
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /difficulties in controlling your actions/);
    assert.equal(source.where, 'inventory');
    assert.equal(source.in_use, true);
    input.feed(' ');
    const result = await reading;
    assert.equal(result.spentTime, true);
    assert.equal(source.where, 'gone');
    assert.ok(!game._occupation);
    assert.equal(game._helplessTurns, OBJECT_DELAY[SPE_LIGHT]);
    assert.equal(game._helplessDoneMessage, '');
    assert.equal((game.spells || []).length, 0);
});
void test('confusion during study repeats the next line and spends the uninterrupted remaining delay', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book(SPE_FIREBALL);
    await studyBook(source);
    await continueSpellbookStudy();
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    const remaining = game.context.spbook.delay;
    game.u.confusionTurns = 10;
    initRng(2n); // Non-destructive confused_book branch.
    acknowledge(t, [
        { prompt: /begin to memorize the runes/, keys: ' ' },
    ]);
    assert.equal(await continueSpellbookStudy(), false);
    assert.equal(game._helplessTurns, -remaining);
    assert.equal(game._helplessDoneMessage, '');
    assert.match(game._pending_message, /reading the next line over and over/);
    assert.equal(game.context.spbook.book, null);
    assert.equal(game.context.spbook.o_id, 0);
    assert.equal(game.context.spbook.delay, 0);
    assert.equal(game.inventory.includes(source), true);
});
void test('a resumed already-cursed book applies its curse after successful learning', async (t) => {
    freshObjectRoom();
    requirePlayingGame(game);
    const source = await book(SPE_LIGHT);
    await studyBook(source);
    acknowledge(t, [
        { prompt: /begin to memorize.*spellbook of light slams shut/, keys: ' ' },
        { prompt: /stop studying.*continue your efforts/, keys: ' ' },
        { prompt: /learn the "light" spell.*wrenching sensation/, keys: ' ' },
    ]);
    await curseObject(source);
    assert.equal(game._occupation, null);
    await studyBook(source);
    assert.ok(game._occupation != null, 'Expected game._occupation to be initialized');
    assert.equal(occupationKey(), 'study-book');
    await finishStudy();
    assert.ok(game.spells[0] != null);
    assert.equal(game.spells[0].otyp, SPE_LIGHT);
    assert.equal(source.spestudied, 1);
    assert.equal(game.inventory.includes(source), true);
    assert.ok(game.context.spbook != null, 'Expected game.context.spbook to be initialized');
    assert.equal(game.context.spbook.book, null);
    assert.match(game._pending_message, /materialize in a different location/);
});
void test('actual scheduler turns complete study and age newly learned spell knowledge once', async (t) => {
    freshObjectRoom({ role: 'wizard' });
    requirePlayingGame(game);
    const source = await book();
    const input = acknowledge(t);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    assert.ok(source.invlet);
    input.feed(source.invlet);
    await rhack('r'.charCodeAt(0));
    let busy = true;
    for (let turn = 0; turn < 30 && busy; turn++) {
        await moveloop_core();
        busy = !!game._occupation;
    }
    assert.equal(busy, false);
    assert.ok(game.spells[0] != null);
    assert.equal(game.spells[0].otyp, SPE_LIGHT);
    assert.equal(currentSpellKnowledge(game.spells[0]), 20001);
    input.display = null;
    const nextCommand = moveloop_core();
    await input.waitUntilBlocked();
    try {
        assert.equal(currentSpellKnowledge(game.spells[0]), 20000);
        assert.equal(game.u.uconduct.literate, 1);
    }
    finally {
        input.feed('\x1b');
        await nextCommand;
    }
});
void test('worn lenses provide the native comprehension bonus for an uncursed book', async (t) => {
    const admitted = [];
    for (const lenses of [false, true]) {
        freshObjectRoom({ hero: { ulevel: 1 } });
        requirePlayingGame(game);
        game.u.acurr.a[A_INT] = 16; // Level-one book: ability18, or20 with lenses.
        const source = await book(SPE_LIGHT, { blessed: false });
        if (lenses)
            await wearEyewear(await addInventoryObject(LENSES));
        acknowledge(t, lenses ? [{ prompt: /wearing a pair of lenses/, keys: ' ' }] : [
            { prompt: /wrenching sensation/, keys: ' ' },
            { prompt: /materialize in a different location/, keys: ' ' },
        ]);
        initRng(4n); // rnd(20) exceeds18, but cannot exceed20.
        await studyBook(source);
        admitted.push(game._occupation?.key === 'study-book');
    }
    requirePlayingGame(game);
    assert.equal(admitted[0], false);
    assert.equal(admitted[1], true);
});
//# sourceMappingURL=spellbook_learning.test.js.map