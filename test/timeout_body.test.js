import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('polymorph duration expiry returns the hero to human form', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('giant ant', { turns: 1 });
    const human = game.u.umonster;
    installPagerInput(input, { expected: /human|again|armor/, limit: 4 });
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.umonnum, human);
    assert.equal(game.u.mtimedone, 0);
});
void test('Unchanging extends a timed form instead of ending its lifetime', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('giant ant', { turns: 1 });
    const form = game.u.umonnum;
    grantIntrinsicProperty('unchanging', 'outside');
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.umonnum, form);
    assert.ok((game.u.mtimedone ?? 0) > 0);
});
void test('prayer freezes polymorph duration and cream on the face', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('giant ant', { turns: 12 });
    game.u.ucreamed = 4;
    game.u.invulnerable = true;
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.mtimedone, 12);
    assert.equal(game.u.ucreamed, 4);
});
void test('cream and the sleep warning advance before property expiry', async () => {
    const input = freshTurnRoom();
    game.u.ucreamed = 4;
    setPropertyTimeout('sleepy', 4);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    input.feed('ll');
    await moveloop_core();
    await moveloop_core();
    assert.equal(game.u.ucreamed, 3);
    assert.equal(game.u.sleepyTurns, 3);
    assert.match(messages.join('\n'), /You yawn\./);
});
//# sourceMappingURL=timeout_body.test.js.map