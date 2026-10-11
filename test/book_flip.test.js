import test from 'node:test';
import assert from 'node:assert/strict';
import { flipThroughBook } from '../js/book_flip.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FORCE_BOLT, } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const SPE_NOVEL = OBJECT_NAMES.indexOf('novel');
void test('underwater page flipping is refused without using time or identifying the book', async () => {
    freshObjectRoom({ hero: { uinwater: 1 } });
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_BLANK_PAPER, { typeKnown: false });
    const result = await flipThroughBook(book);
    assert.equal(result.spentTime, false);
    assert.match(game._pending_message, /pages even more soggy/);
    assert.equal(game._knownObjectTypes?.has(book.otyp) ?? false, false);
    assert.equal(book.where, 'inventory');
});
for (const { name, hero, message } of [
    { name: 'a hearing hero hears rustling', hero: {}, message: /unpleasant rustling sound/ },
    {
        name: 'blindness still permits the rustling sound',
        hero: { blindTurns: 10 },
        message: /unpleasant rustling sound/,
    },
    {
        name: 'hallucination turns rustling into chuckling',
        hero: { hallucinationTurns: 10 },
        message: /unpleasant chuckling sound/,
    },
    {
        name: 'a deaf hero sees the red glow',
        hero: { deafTurns: 10 },
        message: /pages glow faintly red/,
    },
    {
        name: 'a deaf hallucinating hero sees a colored glow',
        hero: { deafTurns: 10, hallucinationTurns: 10 },
        message: /pages glow faintly .+\./,
    },
    {
        name: 'a deaf blind hero feels trembling',
        hero: { deafTurns: 10, blindTurns: 10 },
        message: /pages tremble/,
    },
]) {
    void test(`flipping the Book of the Dead: ${name}`, async () => {
        freshObjectRoom({ hero });
        requirePlayingGame(game);
        const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD);
        resetInputState().feed(' ');
        const result = await flipThroughBook(book);
        assert.equal(result.spentTime, true);
        assert.match(game._pending_message, message);
        assert.equal(book.where, 'inventory');
        assert.ok(!game._occupation);
    });
}
for (const hallucinating of [false, true]) {
    void test(`blind page flipping feels ${hallucinating ? 'freshly picked' : 'rough and dry'} pages without identifying blank paper`, async () => {
        freshObjectRoom({ hero: { blindTurns: 10, hallucinationTurns: hallucinating ? 10 : 0 } });
        requirePlayingGame(game);
        const book = await addInventoryObject(SPE_BLANK_PAPER, { typeKnown: false });
        resetInputState().feed(' ');
        await flipThroughBook(book);
        assert.match(game._pending_message, hallucinating ? /pages feel freshly picked/ : /pages feel rough and dry/);
        assert.equal(game._knownObjectTypes?.has(book.otyp) ?? false, false);
    });
}
void test('blank paper is identified after the flip message has been dismissed', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_BLANK_PAPER, { typeKnown: false });
    const input = resetInputState();
    const flipping = flipThroughBook(book);
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /flip through the pages/);
    assert.equal(game._knownObjectTypes?.has(book.otyp) ?? false, false);
    input.feed(' ');
    await flipping;
    assert.match(game._pending_message, /has nothing written in it/);
    assert.ok(game._knownObjectTypes);
    assert.ok(game._knownObjectTypes.has(book.otyp));
    assert.equal(game.u.uconduct.literate ?? 0, 0);
});
void test('hallucinating blank-paper flipping identifies its poor plot', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 10 } });
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_BLANK_PAPER, { typeKnown: false });
    resetInputState().feed(' ');
    await flipThroughBook(book);
    assert.match(game._pending_message, /doesn't have much of a plot/);
    assert.ok(game._knownObjectTypes);
    assert.ok(game._knownObjectTypes.has(book.otyp));
});
for (const type of [SPE_FORCE_BOLT, SPE_NOVEL]) {
    void test(`hallucination animates initials in ${OBJECT_NAMES[type]}`, async () => {
        freshObjectRoom({ hero: { hallucinationTurns: 10 } });
        requirePlayingGame(game);
        const book = await addInventoryObject(type);
        resetInputState().feed(' ');
        await flipThroughBook(book);
        assert.match(game._pending_message, /enjoy the animated initials/);
    });
}
void test('a novel invites reading and uses its book name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const novel = await addInventoryObject(SPE_NOVEL);
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
    };
    input.feed(' ');
    await flipThroughBook(novel);
    assert.match(messages.join('\n') + game._pending_message, /pages of the novel/);
    assert.match(game._pending_message, /might be interesting to read/);
});
void test('an unidentified novel is a paperback book rather than a spellbook', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const novel = await addInventoryObject(SPE_NOVEL, { typeKnown: false });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
    };
    input.feed(' ');
    await flipThroughBook(novel);
    assert.match(messages.join('\n') + game._pending_message, /pages of the paperback book/);
    assert.doesNotMatch(messages.join('\n'), /spellbook/);
});
void test('flipping an unseen spellbook does not reveal its type or personal name', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_FORCE_BOLT, {
        observed: false,
        typeKnown: false,
        dknown: false,
        oextra: { oname: 'My Secret' },
    });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        messages.push(game._pending_message);
    };
    input.feed(' ');
    await flipThroughBook(book);
    assert.match(messages.join('\n') + game._pending_message, /pages of the spellbook\./);
    assert.doesNotMatch(messages.join('\n') + game._pending_message, /force bolt|My Secret/);
    assert.equal(book.dknown, false);
    assert.equal(game._knownObjectTypes?.has(book.otyp) ?? false, false);
});
for (const [studies, expected] of [
    [0, 'fresh'],
    [1, 'slightly faded'],
    [2, 'very faded'],
    [3, 'extremely faded'],
    [4, 'barely visible'],
    [8, 'barely visible'],
]) {
    void test(`a spellbook studied ${studies} times reports ${expected} ink without learning its spell`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const book = await addInventoryObject(SPE_FORCE_BOLT, { spestudied: studies });
        resetInputState().feed(' ');
        await flipThroughBook(book);
        assert.match(game._pending_message, new RegExp(`magical ink in this spellbook is ${expected}\\.`));
        assert.equal(book.spestudied, studies);
        assert.equal(game.spells?.length ?? 0, 0);
        assert.ok(!game._occupation);
    });
}
//# sourceMappingURL=book_flip.test.js.map