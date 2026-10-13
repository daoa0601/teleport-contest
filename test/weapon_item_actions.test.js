import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ARROW, BOW, KATANA, SHORT_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
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
for (const quantity of [1, 2]) {
    void test(`the fire action describes ${quantity === 1 ? 'a named launcher' : 'named stacked launchers'} by the simple object name`, async () => {
        freshObjectRoom();
        const bow = await addInventoryObject(BOW, { oname: 'LongShot', quan: quantity });
        const arrows = await addInventoryObject(ARROW, { quan: 4 });
        await setPrimaryWeapon(bow);
        await setQuiverObject(arrows);
        const input = resetInputState();
        let fireLabel = '';
        input.beforeRead = () => {
            for (let row = 0; row < 14; row++) {
                const text = requireScreenRow(row).map(cell => cell.ch).join('');
                if (text.includes('f - '))
                    fireLabel = text.trim();
            }
        };
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: arrows.invlet },
            { prompt: /Do what with the arrows\?/, keys: '\x1b' },
        ]);
        assert.match(fireLabel, quantity === 1
            ? /^f - Shoot one of these with your wielded bow$/
            : /^f - Shoot one of these with your wielded bows$/);
        assert.equal(bow.oname, 'LongShot');
        assert.equal(game.context.move, 0);
    });
}
void test('an alternate weapon offers its native wielding, quiver, and two-weapon actions', async () => {
    const alternate = await samuraiWeapons();
    const input = resetInputState();
    let reads = 0;
    input.display = {
        async readKey() {
            if (reads++ === 0)
                return alternate.invlet.charCodeAt(0);
            const menu = Array.from({ length: 14 }, (_, row) => requireScreenRow(row).map(cell => cell.ch).join('')).join('\n');
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
//# sourceMappingURL=weapon_item_actions.test.js.map