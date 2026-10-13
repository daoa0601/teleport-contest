import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { KATANA, SHORT_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

async function samuraiWeapons() {
    freshObjectRoom({ role: 'samurai' });
    const primary = await addInventoryObject(KATANA);
    const alternate = await addInventoryObject(SHORT_SWORD);
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(alternate);
    return alternate;
}

void test('an alternate weapon offers its native wielding, quiver, and two-weapon actions', async () => {
    const alternate = await samuraiWeapons();
    const input = resetInputState();
    let reads = 0;
    input.display = {
        async readKey() {
            if (reads++ === 0) return alternate.invlet.charCodeAt(0);
            const menu = Array.from({ length: 14 }, (_, row) =>
                requireScreenRow(row).map(cell => cell.ch).join('')).join('\n');
            assert.match(menu, /Wield '-' to un-wield this weapon/);
            assert.match(menu, /Engrave on the floor with this item/);
            assert.match(menu, /Quiver this item for easy throwing with 'f'ire/);
            assert.match(menu, /Wield this item as your weapon/);
            assert.match(menu, /Swap this with your main weapon/);
            assert.match(menu, /Toggle two-weapon combat on/);
            return 27;
        },
    };

    await rhack('i'.charCodeAt(0));

    assert.equal(reads, 2);
    assert.equal(game.context.move, 0);
    assert.equal(game.uswapwep, alternate);
});

void test('quivering through the item menu uses the selected alternate weapon', async () => {
    const alternate = await samuraiWeapons();
    requirePlayingGame(game);
    const input = resetInputState();
    let reads = 0;
    input.display = {
        async readKey() {
            if (reads === 2) {
                assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /Ready it instead\?/);
                reads++;
                return 'y'.charCodeAt(0);
            }
            assert.ok(reads < 2, 'The queued action must retain its selected inventory object.');
            return reads++ === 0 ? alternate.invlet.charCodeAt(0) : 'Q'.charCodeAt(0);
        },
    };

    await rhack('i'.charCodeAt(0));
    await rhack(0);

    assert.equal(game.uquiver, alternate);
    assert.equal(game.uswapwep, null);
    assert.equal(reads, 3);
});
