import { loadScoreRecords } from '../js/score_records.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { A_STR } from '../js/const.js';
import { SCORE_RECORD_STORAGE_KEY } from '../js/end.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { AMULET_OF_LIFE_SAVING, GAUNTLETS_OF_POWER, SPE_TURN_UNDEAD, } from '../js/object_data.js';
import { curseObjectState } from '../js/object_state.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
async function prepareContactPoisonBook() {
    const book = await addInventoryObject(SPE_TURN_UNDEAD);
    curseObjectState(book);
    // A level-six book can produce contact poison; this seed selects it.
    initRng(8n);
    const input = resetInputState();
    input.feed(book.invlet);
    // Poison can produce one injury, one life-saving sequence, and two final
    // score screens. Every requested acknowledgment must belong to that prose.
    installPagerInput(input, {
        expected: /contact poison|gloves.*corrode|You die|But wait|medallion|feel much better|spellbook crumbles|Goodbye|killed by a contact-poisoned spellbook|Points.*Name/,
        limit: 10,
    });
    return { book, input };
}
void test('fatal contact poison stops book study without consuming the book', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 100, ulevel: 1 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 4;
    game.u.urexp = 100;
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    const { book, input } = await prepareContactPoisonBook();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || ''); };
    await rhack('r'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.match(messages.join('\n'), /book was coated with contact poison/);
    assert.equal(game.u.umortality, 1);
    assert.equal(game.u.uhpmax, 100);
    assert.equal(game.u.acurr.a[A_STR], 4);
    assert.notEqual(book.where, 'gone');
    assert.equal(book.in_use, false);
    assert.ok(!game._occupation);
    assert.notEqual(game._helplessReason, 'reading a book');
    const records = loadScoreRecords(game);
    assert.equal(records[0]?.death, 'killed by a contact-poisoned spellbook');
});
void test('worn gloves absorb spellbook contact poison and corrode', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 4;
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER);
    wearHeroArmor(gloves);
    await prepareContactPoisonBook();
    await rhack('r'.charCodeAt(0));
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.uhp, 1);
    assert.equal(game.u.acurr.a[A_STR], 4);
    assert.equal(gloves.oeroded2, 1);
    assert.equal(game._helplessReason, 'reading a book');
});
void test('poison resistance reduces contact poison without preventing its damage', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, poisonResistance: true } });
    requirePlayingGame(game);
    await prepareContactPoisonBook();
    await rhack('r'.charCodeAt(0));
    assert.ok(game.u.uhp >= 94 && game.u.uhp <= 99);
    assert.ok(game.u.acurr.a[A_STR] >= 10 && game.u.acurr.a[A_STR] <= 11);
    assert.equal(game.u.uhpmax, 100);
    assert.equal(game._helplessReason, 'reading a book');
});
void test('life saving lets contact poison finish and then immobilizes the reader', async () => {
    freshObjectRoom({ hero: { uhp: 1, uhpmax: 100, ulevel: 1 } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 4;
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    await prepareContactPoisonBook();
    await rhack('r'.charCodeAt(0));
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.umortality, 1);
    assert.equal(amulet.where, 'gone');
    assert.ok(game.u.uhp > 0 && game.u.uhp < game.u.uhpmax);
    assert.ok(game.u.uhpmax < 100);
    assert.equal(game.u.acurr.a[A_STR], 3);
    assert.equal(game._helplessReason, 'reading a book');
    assert.ok(game._helplessTurns !== undefined && game._helplessTurns !== null, 'Expected game._helplessTurns to be initialized');
    assert.ok(game._helplessTurns > 0);
    assert.ok(!game._occupation);
});
//# sourceMappingURL=spellbook_study.test.js.map