import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('looking inside shop merchandise quotes the contained goods without buying them', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    const chest = await floorObject(CHEST, game.u.ux, game.u.uy, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    const club = await knownObject(CLUB, { where: 'free', no_charge: false });
    await addObjectToContainer(chest, club);
    const input = resetInputState();
    let contents = '';
    let answers = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++answers < 8, `Unexpected loot input: ${screen}`);
            if (screen.includes('Contents of the chest:')) {
                contents = screen;
                return 32;
            }
            assert.match(screen, /Do what|Look inside/);
            return 'q'.charCodeAt(0);
        },
    };
    await runExtendedCommand('loot', ':');
    assert.match(contents, /club \(for sale, \d+ zorkmids\)/);
    assert.equal(!!club.unpaid, false);
    assert.equal(shopkeeper.eshk.bill.length, 0);
    assert.equal(chest.contents?.includes(club), true);
});
//# sourceMappingURL=container_contents_price.test.js.map