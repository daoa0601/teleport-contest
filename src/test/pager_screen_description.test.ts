import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { ENGRAVE, FOUNTAIN } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

async function lookEast(): Promise<string> {
    resetInputState().feed('l.   ');
    await rhack(';'.charCodeAt(0));
    await flush_screen(1);
    assert.equal(game.context.move, 0);
    return requireGameDisplay().grid.slice(0, 3).map(row => row.map(cell => cell.ch).join('')).join('');
}

void test('quick look identifies the weapon class before the particular object', async () => {
    freshObjectRoom({ flags: { tips: false } });
    await floorObject(DAGGER, 11, 10, { known: false, bknown: false });
    newsym(11, 10);

    assert.match(await lookEast(), /^\)\s+a weapon \(a dagger\)/);
});

void test('quick look lists both meanings of a fountain symbol', async () => {
    const level = freshObjectRoom({ flags: { tips: false } });
    level.requireAt(11, 10).typ = FOUNTAIN;
    newsym(11, 10);

    assert.match(await lookEast(), /^\{\s+a sink or a fountain \(fountain\)/);
});

for (const read of [false, true]) {
    void test(`quick look quotes only remembered engraving text with read=${read}`, async () => {
        freshObjectRoom({ flags: { tips: false } });
        const engraving = makeEngravingAt(11, 10, 'Elbereth', null, 0, ENGRAVE);
        assert.ok(engraving);
        engraving.erevealed = true;
        engraving.eread = read;
        engraving.rememberedText = 'Elbereth';
        engraving.text = 'a newer inscription';
        newsym(11, 10);

        const text = await lookEast();
        assert.match(text, read ? /engraving with remembered text: "Elbereth"/
            : /engraving that you haven't read/);
        assert.doesNotMatch(text, /newer inscription/);
        assert.equal(engraving.eread, read);
    });
}
