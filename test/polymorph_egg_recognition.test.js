import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG } from '../js/object_data.js';
import { objectDescription } from '../js/object_description.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [form, eggSpecies] of [
    ['red dragon', 'red dragon'], ['queen bee', 'killer bee'],
    ['winged gargoyle', 'gargoyle'],
]) {
    void test(`becoming a ${form} teaches recognition of its ${eggSpecies} eggs`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        const egg = await addInventoryObject(EGG, {
            corpsenm: MONSTER_NAME.indexOf(eggSpecies), known: false,
        });
        assert.doesNotMatch(await objectDescription(egg), new RegExp(eggSpecies));
        pushKeys(`polyself\n${form}\n                        `);
        await rhack('#'.charCodeAt(0));
        assert.match(await objectDescription(egg), new RegExp(`${eggSpecies} egg`));
        assert.equal(egg.known, false);
    });
}
//# sourceMappingURL=polymorph_egg_recognition.test.js.map