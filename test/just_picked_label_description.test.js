import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MENU_FULL } from '../js/const.js';
import { DAGGER, POT_WATER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshObjectRoom } from './support/object-room.js';
// pickup.c:query_category() renders the single just-picked category entry
// through doname(find_justpicked(olist)).  objnam.c:xname_flags() observes
// the object while the hero can see, so a stack whose appearance knowledge
// was lost is named by its description again: trap.c:water_damage() turns
// an over-diluted potion stack into potions of water and clears dknown,
// and the later menu label names them "4 clear potions", not "4 potions".
// A second object class keeps query_category() from collapsing to a single
// category.
async function justPickedUnseenWater() {
    await freshObjectRoom({ flags: { menu_style: MENU_FULL } });
    await addInventoryObject(DAGGER);
    const water = await addInventoryObject(POT_WATER, {
        quan: 4, dknown: false, bknown: false, typeKnown: false, observed: false,
    });
    water.pickup_prev = true;
}
void test('the type-inventory menu names an unseen just-picked stack by description', async (t) => {
    await justPickedUnseenWater();
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /What type of object do you want an inventory of\?/, keys: '\x1b' },
    ]);
    await rhack('I'.charCodeAt(0));
    assert.match(menu, /P - Just picked up: 4 clear potions/);
});
void test('the drop-type menu names an unseen just-picked stack by description', async (t) => {
    await justPickedUnseenWater();
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Drop what type of items\?/, keys: '\x1b' },
    ]);
    await rhack('D'.charCodeAt(0));
    assert.match(menu, /P - Just picked up: 4 clear potions/);
});
//# sourceMappingURL=just_picked_label_description.test.js.map