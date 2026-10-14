import assert from 'node:assert/strict';
import test from 'node:test';

import { requireGameLevel } from '../js/gstate.js';
import { LAND_MINE, POT_HEALING } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a potion call name is not interpreted as holy water', async () => {
    freshObjectRoom();
    recordObjectCall(POT_HEALING, 'holy water');

    const result = await readObjectName('uncursed potion called holy water', { wizardWish: true });

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, POT_HEALING);
    assert.equal(result.object.blessed, false);
});

void test('a call name does not arm a wished land mine', async () => {
    freshObjectRoom();

    const result = await readObjectName('land mine called digger', { wizardWish: true });

    assert.ok(result && !result.noWish, 'The mine should be an object');
    assert.equal(result.object.otyp, LAND_MINE);
    assert.equal(requireGameLevel().traps.length, 0);
});

void test('ordinary trapped chest wishes retain a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });

    const result = await readObjectName('trapped chest');

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, true);
});

void test('an ordinary untrapped chest wish removes a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });

    const result = await readObjectName('untrapped chest');

    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, false);
});
