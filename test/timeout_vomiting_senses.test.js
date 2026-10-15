import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { advanceHeroVomiting, heroIsVomiting, vomitingDialogue } from '../js/hero_illness.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshTurnRoom } from './support/playable-room.js';
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
void test('untimed nausea lets the hero keep moving without vomiting or losing extra nutrition', async () => {
    const input = freshTurnRoom({ hero: { uhunger: 900 } });
    grantIntrinsicProperty('vomiting', 'outside');
    const moves = game.moves;
    input.feed('lll');
    await moveloop_core();
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.moves, moves + 2);
    assert.equal(game.u.uhunger, 898);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game.u.ux, 13);
    assert.equal(heroIsVomiting(), true);
});
//# sourceMappingURL=timeout_vomiting_senses.test.js.map