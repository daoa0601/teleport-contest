import assert from 'node:assert/strict';
import test from 'node:test';
import { doquit } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import { resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { LARGE_BOX, POT_HEALING, SACK, WAN_FIRE } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

function endingRoom(disclose: string) {
    freshObjectRoom({ flags: { bones: false, disclose, tombstone: false } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const screens: string[] = [];
    const input = resetInputState();
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            screens.push(screen);
            assert.ok(screens.length < 20, `Unexpected ending prompt: ${screen}`);
            return (screen.includes('Really quit without saving?') ? 'y' : ' ').charCodeAt(0);
        },
    };
    return screens;
}

void test('fatal damage identifies carried items even when all disclosure is disabled', async () => {
    endingRoom('none');
    const potion = await addInventoryObject(POT_HEALING, {
        observed: false, typeKnown: false, known: false, bknown: false, dknown: false, rknown: false,
    });

    assert.equal(await loseHeroHp(100, 'falling rock'), true);

    assert.equal(game._knownObjectTypes?.has(POT_HEALING), true);
    assert.equal(potion.known, true);
    assert.equal(potion.bknown, true);
    assert.equal(potion.dknown, true);
    assert.equal(potion.rknown, true);
});

void test('quitting discloses and identifies nested container contents after the inventory', async () => {
    const screens = endingRoom('+i -a -v -g -c -o');
    const box = await addInventoryObject(LARGE_BOX, { cknown: false, lknown: false });
    const sack = await knownObject(SACK, { where: 'free', cknown: false, lknown: false });
    const wand = await knownObject(WAN_FIRE, {
        where: 'free', spe: 3, known: false, typeKnown: false, bknown: false, dknown: false,
    });
    await addObjectToContainer(sack, wand);
    await addObjectToContainer(box, sack);

    await doquit();

    const outerPage = screens.findIndex(screen => screen.includes('Contents of the large box:'));
    const innerPage = screens.findIndex(screen => screen.includes('Contents of the sack:'));
    assert.ok(outerPage >= 0, 'Disclosure must show the carried box contents');
    assert.ok(innerPage > outerPage, 'Disclosure visits the nested sack after its containing box');
    assert.match(screens[innerPage] ?? '', /wand of fire.*\(0:3\)/);
    assert.equal(wand.known, true);
    assert.equal(game._knownObjectTypes?.has(WAN_FIRE), true);
    assert.equal(box.cknown, true);
    assert.equal(box.lknown, true);
    assert.equal(sack.cknown, true);
    assert.equal(sack.lknown, true);
});
