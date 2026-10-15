import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { SPE_FINGER_OF_DEATH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const antimagic of [false, true]) {
    void test(`an exploding cursed book describes its released energy${antimagic ? ' against antimagic' : ''}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, antimagic } });
        requirePlayingGame(game);
        const book = await addInventoryObject(SPE_FINGER_OF_DEATH, { cursed: true });
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[book.otyp] = 'vellum';
        const input = resetInputState();
        input.feed(book.invlet);
        installPagerInput(input, { expected: /book.*(?:energy|explodes)/, limit: 2 });
        // Select cursed_book()'s explosive-rune effect for this level-seven book.
        initRng(6n);
        await rhack('r'.charCodeAt(0));
        assert.match(game._lastPlineMessage, antimagic
            ? /The book radiates explosive energy, but you are unharmed!/
            : /As you read the book, it radiates explosive energy in your face!/);
        assert.equal(book.where, 'gone');
        assert.equal(game.u.uhp === 100, antimagic);
        assert.equal(game._helplessReason, 'reading a book');
    });
}
//# sourceMappingURL=spellbook_explosion.test.js.map