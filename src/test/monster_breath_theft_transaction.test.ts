import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { punishHero } from '../js/punishment.js';
import { performMonsterHeroAttack } from '../js/mhitu.js';
import { APPLE } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C mhitu.c:875-876 — mattacku()'s AT_BREA case awaits breamu(), so the
// breath line, dobuzz() and its whole tail complete inside the monster's
// own turn; nothing is left for a later presentation pass
// (mthrowu.c:1118-1144).
void test('a dragon completes its whole breath transaction inside the monster turn', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10, MM_ANGRY | NO_MINVENT);
    dragon.mux = 14;
    dragon.muy = 10;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(10));

    const action = await runMonsterAction(
        dragon, game, () => 1, (count, sides) => count * sides, () => 1,
    );

    const log = messages.join('\n') + game._pending_message;
    assert.ok(action.movement, 'The dragon must have a movement action.');
    assert.match(log, /breathes fire!/);
    assert.ok(game.u.uhp < 100,
        'dobuzz() runs inside the turn; the fire ray already damaged the hero');
});

// Order pin for the uhitm.c:mhitm_ad_sedu() mhitu branch after PR 537's
// shape. The theft change is a pure code motion, so this order is identical
// before and after the refactor by design; the fails-before coverage lives
// in the breath test above.
// C uhitm.c:4637-4641, 4675-4688; mhitu.c:939-944: an animal announces
// hitmsg() first, then steal() takes the item, the thief flees with it, and
// the M_ATTK_AGR_DONE result ends the attack set before the monkey's bite.
void test('a thieving monkey announces the hit, steals once and flees', async () => {
    await freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const apple = await addInventoryObject(APPLE);
    const monkey = await createMonsterAt('monkey', 11, 10,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(10));

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });

    const log = messages.join('\n') + game._pending_message;
    const hit = log.indexOf('The monkey hits!');
    const stole = log.indexOf('The monkey stole');
    const fled = log.indexOf('tries to run away with');
    assert.ok(hit >= 0, 'hitmsg() precedes the theft');
    assert.ok(stole > hit, `steal() follows hitmsg(); log: ${log}`);
    assert.ok(fled > stole, `the flight follows steal(); log: ${log}`);
    assert.equal((log.match(/The monkey hits/g) ?? []).length, 1,
        'the theft ends the attack set before the bite slot');
    assert.equal(game.inventory.includes(apple), false);
    assert.ok((monkey.minvent ?? []).includes(apple));
});

// C steal.c:381-390: a punished hero with an otherwise empty inventory
// reaches nothing_to_steal through the chain — the removal prose, then
// unpunish, then mhitm_ad_sedu()'s default tail (rloc, flight,
// M_ATTK_AGR_DONE) with no theft line and no retaliation grant.
void test('an empty-handed punished hero loses the chain to the fleeing nymph', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    await punishHero();
    const ball = game.uball;
    assert.ok(ball);
    const nymph = await createMonsterAt('water nymph', 11, 10,
        MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(' '.repeat(10));

    await performMonsterHeroAttack(nymph, game,
        { random: limit => Math.min(1, limit - 1), rollOne: () => 1 });
    messages.push(game._pending_message);

    const log = messages.join('\n');
    assert.match(log, /takes off the iron chain/);
    assert.doesNotMatch(log, / stole /,
        'the chain release prints no theft line');
    assert.match(log, /vanishes and reappears/,
        'mhitm_ad_sedu() teleports the empty-handed thief away');
    assert.equal(game.u.punished, false);
    assert.equal(game.uchain, null);
    assert.equal(game.uball, null);
    assert.equal((nymph.minvent ?? []).includes(ball), false);
    assert.equal(ball.where, 'floor');
    assert.ok(!nymph.mavenge, 'Unpunishing the hero does not grant retaliation');
});
