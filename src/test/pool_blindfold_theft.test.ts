import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { heroIsBlind } from '../js/senses.js';
import { BLINDFOLD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { applyInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

void test('a monkey stealing a blindfold is named once the hero can see it', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD);
    await applyInventoryObject(blindfold);
    assert.equal(heroIsBlind(game), true);
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /Something|monkey|blindfold|see again/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.equal(heroIsBlind(game), false);
    assert.ok(monkey.minvent.includes(blindfold));
    const prose = messages.join('\n');
    assert.match(prose, /The monkey stole/);
    assert.match(prose, /The monkey tries to run away/);
    assert.doesNotMatch(prose, /Something (?:stole|tries to run away)/);
});

void test('a nymph names herself again after blindfold removal produces sight feedback', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD);
    await applyInventoryObject(blindfold);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /Someone|nymph|blindfold|see again/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
    messages.push(game._pending_message);

    assert.ok(nymph.minvent.includes(blindfold));
    assert.match(messages.join('\n'), /You can see again\.[\s\S]*The water nymph stole/);
});
