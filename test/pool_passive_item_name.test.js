import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { applyMonsterPassiveToObject } from '../js/monster_passive.js';
import { LEATHER_GLOVES, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
void test('a disenchanter describes a pair of gloves as one item when draining it', async () => {
    freshObjectRoom();
    const disenchanter = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
    const gloves = await addInventoryObject(LEATHER_GLOVES, { spe: 3 });
    const messages = [];
    await applyMonsterPassiveToObject(disenchanter, gloves, {
        random: limit => limit - 1, publish: message => { messages.push(message); },
    });
    assert.equal(gloves.spe, 2);
    assert.deepEqual(messages, ['Your pair of leather gloves seems less effective.']);
});
for (const blind of [false, true]) {
    void test(`disenchantment ${blind ? 'preserves an unseen ring name while blind' : 'reveals the known type of an unseen ring'}`, async () => {
        freshObjectRoom({ hero: { blindTurns: blind ? 10 : 0 } });
        const disenchanter = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
        const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), {
            spe: 3, dknown: false, observed: false,
        });
        const messages = [];
        await applyMonsterPassiveToObject(disenchanter, ring, {
            random: limit => limit - 1, publish: message => { messages.push(message); },
        });
        assert.equal(ring.spe, 2);
        assert.equal(messages[0], blind ? 'Your ring seems less effective.'
            : 'Your ring of gain strength seems less effective.');
        assert.equal(ring.dknown, !blind);
    });
}
//# sourceMappingURL=pool_passive_item_name.test.js.map