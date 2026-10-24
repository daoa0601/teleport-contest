import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addObjectToContainer } from '../js/object_container.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, SACK, SPE_BOOK_OF_THE_DEAD, } from '../js/object_data.js';
import { artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [name, type] of [
    ['Amulet', AMULET_OF_YENDOR],
    ['Bell', BELL_OF_OPENING],
    ['Candelabrum', CANDELABRUM_OF_INVOCATION],
    ['Book', SPE_BOOK_OF_THE_DEAD],
]) {
    void test(`Vlad keeps his vampire form while carrying the ${name}`, async () => {
        freshObjectRoom();
        const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, NO_MINVENT);
        const originalForm = vlad.mnum;
        const object = await addObjectToMonsterInventory(vlad, await knownObject(type));
        await changeMonsterForm(vlad, null, game);
        assert.equal(vlad.mnum, originalForm, `Vlad must stay able to carry the ${name}`);
        assert.ok(object && vlad.minvent?.includes(object));
    });
}
void test('Vlad keeps his vampire form for another role’s quest artifact', async () => {
    freshObjectRoom();
    const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, NO_MINVENT);
    const originalForm = vlad.mnum;
    await addObjectToMonsterInventory(vlad, await artifactObject('The Orb of Detection'));
    await changeMonsterForm(vlad, null, game);
    assert.equal(vlad.mnum, originalForm);
});
void test('a bagged invocation tool does not prevent Vlad from changing shape', async () => {
    freshObjectRoom();
    const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, NO_MINVENT);
    const originalForm = vlad.mnum;
    const sack = await knownObject(SACK);
    await addObjectToMonsterInventory(vlad, sack);
    await addObjectToContainer(sack, await knownObject(BELL_OF_OPENING));
    await changeMonsterForm(vlad, null, game);
    assert.notEqual(vlad.mnum, originalForm);
});
void test('an ordinary artifact does not prevent Vlad from changing shape', async () => {
    freshObjectRoom();
    const vlad = await createMonsterAt('Vlad the Impaler', 12, 10, NO_MINVENT);
    const originalForm = vlad.mnum;
    await addObjectToMonsterInventory(vlad, await artifactObject('Sting'));
    await changeMonsterForm(vlad, null, game);
    assert.notEqual(vlad.mnum, originalForm);
});
//# sourceMappingURL=monster_special_objects.test.js.map