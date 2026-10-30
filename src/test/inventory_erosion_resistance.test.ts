import assert from 'node:assert/strict';
import test from 'node:test';
import { erodeObject } from '../js/object_erosion.js';
import { CLUB } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive } from '../js/properties.js';
import { ensureQuestStatus } from '../js/quest.js';
import { addInventoryItem } from '../js/u_init.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { source, roll, erosion } of [
    { source: 'carried artifact', roll: 98, erosion: 0 },
    { source: 'carried artifact', roll: 99, erosion: 1 },
    { source: 'intrinsic', roll: 0, erosion: 1 },
]) {
    void test(`fire erosion with ${source} resistance and a protection roll of ${roll}`, async () => {
        await freshObjectRoom({ role: 'priest', hero: { ualign: { type: 1, record: 10 } } });
        ensureQuestStatus().touched_artifact = true;
        const club = await addInventoryObject(CLUB);
        if (source === 'carried artifact')
            await addInventoryItem(await artifactObject('The Mitre of Holiness'));
        else grantIntrinsicProperty('fireResistance', 'outside');
        assert.equal(propertyIsActive('fireResistance'), true);

        await erodeObject(club, 'burn', { random: () => roll, publish: async () => {} });

        assert.equal(club.oeroded ?? 0, erosion);
    });
}
