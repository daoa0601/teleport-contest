import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { CORPSE, DAGGER } from '../js/object_data.js';
import { objectCombatName, ownedObjectName } from '../js/objnam.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an ownership message lets a priest recognize beatitude while blind', async () => {
    freshObjectRoom({ role: 'priest', hero: { blindTurns: 10 } });
    const dagger = await knownObject(DAGGER, { bknown: false, dknown: false, where: 'inventory' });

    ownedObjectName(dagger, game);

    assert.equal(dagger.bknown, true);
    assert.equal(dagger.dknown, false);
});

void test('corpse-species contact names do not count as observing the corpse', async () => {
    freshObjectRoom({ role: 'priest' });
    const corpse = await knownObject(CORPSE, { bknown: false, dknown: false });

    objectCombatName(corpse);

    assert.equal(corpse.bknown, false);
    assert.equal(corpse.dknown, false);
});
