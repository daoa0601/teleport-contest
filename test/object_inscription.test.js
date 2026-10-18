import test from 'node:test';
import assert from 'node:assert/strict';
import { flushPendingTopline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { ALCHEMY_SMOCK, CANDY_BAR, CLUB, HAWAIIAN_SHIRT, OBJECT_NAMES } from '../js/object_data.js';
import { minimalObjectName, objectName } from '../js/objnam.js';
import { readOrdinaryObject } from '../js/readable_objects.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');
async function readOutput(object) {
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(screen, /--More--/, 'Reading this object only needs message acknowledgements');
        input.feed(' ');
    };
    const result = await readOrdinaryObject(object);
    await flushPendingTopline();
    return { result, text: [...messages, game._pending_message || ''].join('\n') };
}
for (const [type, garment] of [[T_SHIRT, 'T-shirt'], [ALCHEMY_SMOCK, 'apron']]) {
    for (const eroded of [false, true]) {
        void test(`end-of-game ${eroded ? 'eroded' : 'intact'} ${garment} text agrees with reading without adding literacy`, async () => {
            freshObjectRoom({ flags: { verbose: false } });
            requirePlayingGame(game);
            game.ubirthday = 12345;
            const object = await knownObject(type, {
                bknown: false, o_id: 41, oname: 'Keepsake',
                oeroded: eroded ? 1 : 0, oeroded2: eroded ? 3 : 0,
            });
            assert.doesNotMatch(objectName(object), / with text /);
            game.program_state.gameover = true;
            const disclosed = objectName(object);
            const text = disclosed.match(/ with text "(.*)" named Keepsake$/)?.[1];
            assert.ok(text !== undefined, `Expected the inscription before the personal name: ${disclosed}`);
            assert.ok(inventoryItemDescription(object).includes(`with text "${text}" named Keepsake`));
            assert.equal(game.u.uconduct.literate || 0, 0);
            if (eroded) {
                const intact = objectName({ ...object, oeroded: 0, oeroded2: 0 });
                assert.notEqual(disclosed, intact, 'The displayed inscription must show its erosion');
            }
            game.program_state.gameover = false;
            const reading = await readOutput(object);
            assert.equal(reading.result.spentTime, true);
            assert.ok(reading.text.includes(`"${text}"`), reading.text);
            assert.equal(game.u.uconduct.literate, 1);
        });
    }
}
void test('dummy and minimal naming views omit end-of-game inscriptions', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const shirt = await knownObject(T_SHIRT, { bknown: false });
    game.program_state.gameover = true;
    assert.match(objectName(shirt), / with text /);
    assert.equal(minimalObjectName(shirt), 'T-shirt');
    assert.equal(objectName({ otyp: T_SHIRT, oclass: 3, dknown: true }), 'T-shirt');
    assert.equal(objectName({ otyp: T_SHIRT, oclass: 3, o_id: 0, dknown: true }), 'T-shirt');
});
void test('candy stack disclosure pluralizes the bar before its wrapper and personal name', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const candy = await knownObject(CANDY_BAR, {
        bknown: false, spe: 2, quan: 3, oname: 'Snack',
    });
    assert.doesNotMatch(objectName(candy), / labeled /);
    game.program_state.gameover = true;
    const singleName = objectName(candy);
    const label = singleName.match(/^candy bar labeled "(.+)" named Snack$/)?.[1];
    assert.ok(label !== undefined, singleName);
    assert.equal(inventoryItemDescription(candy), `3 candy bars labeled "${label}" named Snack`);
    assert.equal(game.u.uconduct.literate || 0, 0);
    game.program_state.gameover = false;
    const reading = await readOutput(candy);
    assert.equal(reading.result.spentTime, true);
    assert.ok(reading.text.includes(`The wrapper reads: "${label}".`), reading.text);
    assert.equal(candy.quan, 3);
    assert.equal(game.u.uconduct.literate, 1);
});
void test('a blank candy wrapper remains absent from disclosure and does not grant literacy', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const candy = await knownObject(CANDY_BAR, { bknown: false, spe: 0 });
    game.program_state.gameover = true;
    assert.equal(objectName(candy), 'candy bar');
    assert.equal(inventoryItemDescription(candy), 'a candy bar');
    assert.equal(game.u.uconduct.literate || 0, 0);
    game.program_state.gameover = false;
    const reading = await readOutput(candy);
    assert.equal(reading.result.spentTime, false);
    assert.match(reading.text, /wrapper is blank/);
    assert.equal(game.u.uconduct.literate || 0, 0);
});
void test('Hawaiian disclosure uses a singular motif while reading describes the full design', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.ubirthday = 0;
    const shirt = await knownObject(HAWAIIAN_SHIRT, { bknown: false, o_id: 10 });
    assert.doesNotMatch(objectName(shirt), /motif/);
    game.program_state.gameover = true;
    assert.equal(objectName(shirt), 'Hawaiian shirt with an orchid motif');
    assert.doesNotMatch(inventoryItemDescription(shirt), /background/);
    assert.equal(game.u.uconduct.literate || 0, 0);
    game.program_state.gameover = false;
    const reading = await readOutput(shirt);
    assert.equal(reading.result.spentTime, true);
    assert.match(reading.text, /It features orchids on an? .+ background\./);
    assert.equal(game.u.uconduct.literate || 0, 0);
});
void test('end-of-game naming adds no inscription to an ordinary weapon', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const club = await knownObject(CLUB, { bknown: false });
    game.program_state.gameover = true;
    assert.equal(objectName(club), 'club');
    assert.equal(game.u.uconduct.literate || 0, 0);
});
//# sourceMappingURL=object_inscription.test.js.map