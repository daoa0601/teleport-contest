import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { addObjectToContainer } from '../js/mkobj.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
// C pickup.c:menu_loot() lists the container's contents through
// query_objlist(), which names every menu entry with doname_with_price():
// shop goods inside a container on the shop floor are quoted "for sale".
void test('the take-out menu quotes shop prices for a container\'s contents', async () => {
    await freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, game.u.ux, game.u.uy, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'free', no_charge: false });
    await addObjectToContainer(chest, club);
    const input = resetInputState();
    let takeOutMenu = '';
    let answers = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++answers < 8, `Unexpected loot input: ${screen}`);
            if (screen.includes('Take out what?')) {
                takeOutMenu = screen;
                return 27;
            }
            assert.match(screen, /Do what with/);
            return 'o'.charCodeAt(0);
        },
    };
    pushKeys('loot\n');
    await rhack('#'.charCodeAt(0));
    assert.match(takeOutMenu, /a - a \+0 club \(for sale, \d+ zorkmids\)/);
    assert.equal(!!club.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(chest.contents?.includes(club), true);
});
//# sourceMappingURL=container_loot_menu_price.test.js.map