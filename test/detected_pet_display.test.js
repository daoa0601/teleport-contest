import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym } from '../js/display.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
for (const detected of [false, true]) {
    for (const { highlight, inverse } of [
        { highlight: false, inverse: false },
        { highlight: false, inverse: true },
        { highlight: true, inverse: false },
        { highlight: true, inverse: true },
    ]) {
        void test(`a ${detected ? 'detected' : 'visible'} pet honors hilite_pet=${highlight} with use_inverse=${inverse}`, async () => {
            freshObjectRoom({ hero: { monsterDetection: detected },
                flags: { hilite_pet: highlight, use_inverse: inverse } });
            const pet = await createMonsterAt('little dog', 11, 10);
            pet.mtame = 10;
            pet.minvis = detected ? 1 : 0;
            newsym(11, 10);
            await flush_screen(1);
            assert.equal(requireScreenCell(10, 11).ch, 'd');
            assert.equal(requireScreenCell(10, 11).attr & ATR_INVERSE, highlight ? ATR_INVERSE : 0);
        });
    }
}
//# sourceMappingURL=detected_pet_display.test.js.map