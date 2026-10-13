import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_HEALING } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a monkey names a newly observed potion appearance when fleeing with it', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = 'magenta';
    const potion = await addInventoryObject(POT_HEALING, {
        dknown: false, typeKnown: false, observed: false,
    });
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(monkey.minvent.includes(potion));
    assert.equal(potion.dknown, true);
    const prose = messages.join('\n');
    assert.match(prose, /The monkey stole an uncursed magenta potion\./);
    assert.match(prose, /The monkey tries to run away with your magenta potion\./);
});

void test('theft while blind does not reveal an unseen potion appearance', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    assert.ok(game.objectDescriptions);
    game.objectDescriptions[POT_HEALING] = 'magenta';
    const potion = await addInventoryObject(POT_HEALING, {
        dknown: false, typeKnown: false, observed: false,
    });
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /Something|monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.ok(monkey.minvent.includes(potion));
    assert.equal(potion.dknown, false);
    assert.match(messages.join('\n'), /stole an uncursed potion\./);
    assert.doesNotMatch(messages.join('\n'), /magenta/);
});
