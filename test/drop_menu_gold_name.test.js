import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { W_QUIVER } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { planInput } from './support/planned-input.js';
import { freshObjectRoom } from './support/object-room.js';
// pickup.c:query_category() renders the single just-picked entry through
// doname(): one gold piece is "a gold piece" (objnam.c:doname_base() gives
// a lone stack the article, not its count) and a quivered stack carries the
// "in quiver pouch" suffix from doname()'s W_QUIVER case.  A second object
// class keeps query_category() from collapsing to a single category.
void test('the drop-type menu names one picked up gold piece with an article', async (t) => {
    freshObjectRoom({ flags: { menu_style: 2 } });
    await addInventoryObject(DAGGER);
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 1 });
    gold.pickup_prev = true;
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Drop what type of items\?/, keys: '\x1b' },
    ]);
    await rhack('D'.charCodeAt(0));
    assert.match(menu, /P - Just picked up: a gold piece/);
});
void test('quivered picked-up gold reports the quiver pouch', async (t) => {
    freshObjectRoom({ flags: { menu_style: 2 } });
    await addInventoryObject(DAGGER);
    const gold = await addInventoryObject(GOLD_PIECE, { quan: 3, owornmask: W_QUIVER });
    gold.pickup_prev = true;
    game.uquiver = gold;
    const input = resetInputState();
    let menu = '';
    input.beforeRead = () => {
        menu = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    };
    planInput(input, t, [
        { prompt: /Drop what type of items\?/, keys: '\x1b' },
    ]);
    await rhack('D'.charCodeAt(0));
    assert.match(menu, /P - Just picked up: 3 gold pieces \(in quiver pouch\)/);
});
//# sourceMappingURL=drop_menu_gold_name.test.js.map