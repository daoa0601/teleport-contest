import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym } from '../js/display.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const { highlight, inverse } of [
    { highlight: false, inverse: true },
    { highlight: true, inverse: false },
]) {
    void test(`a detected pet honors hilite_pet=${highlight} and use_inverse=${inverse}`, async () => {
        freshObjectRoom({ hero: { monsterDetection: true },
            flags: { hilite_pet: highlight, use_inverse: inverse } });
        const pet = await createMonsterAt('little dog', 11, 10);
        pet.mtame = 10;
        pet.minvis = 1;

        newsym(11, 10);
        await flush_screen(1);

        assert.equal(requireScreenCell(10, 11).ch, 'd');
        assert.equal(requireScreenCell(10, 11).attr & ATR_INVERSE, 0);
    });
}
