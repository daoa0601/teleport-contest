import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceHeroVomiting, heroIsVomiting, vomitingDialogue } from '../js/hero_illness.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
void test('nausea recognizes confusion that is not supplied by a countdown', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('confusion', 'outside');
    setPropertyTimeout('vomiting', 12);
    const messages = [];
    await vomitingDialogue({ publish: message => { messages.push(message); } });
    assert.deepEqual(messages, ['You feel slightly more confused.']);
});
void test('nausea recognizes the permanent stun of a bat body', async () => {
    freshObjectRoom();
    installPolymorphedHero('bat');
    setPropertyTimeout('vomiting', 9);
    const messages = [];
    await vomitingDialogue({ publish: message => { messages.push(message); } });
    assert.deepEqual(messages, ["You can't think straight."]);
});
void test('an untimed vomiting source survives the property countdown pass', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('vomiting', 'outside');
    assert.equal(heroIsVomiting(), true);
    await advanceHeroVomiting();
    assert.equal(heroIsVomiting(), true);
});
//# sourceMappingURL=timeout_vomiting_senses.test.js.map