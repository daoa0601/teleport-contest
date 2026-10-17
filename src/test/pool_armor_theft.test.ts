import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack, moveloop_core } from '../js/allmain.js';
import { wearHeroArmor } from '../js/armor.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FEDORA, LEATHER_ARMOR, LEATHER_CLOAK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';

void test('a monkey announces its hit before taking off a worn hat and runs instead of teleporting', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const hat = await addInventoryObject(FEDORA);
    wearHeroArmor(hat);
    const monkey = await createMonsterAt('monkey', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monkey.mux = game.u.ux;
    monkey.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /monkey/, limit: 12 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(monkey, game, { random: () => 0, rollOne: () => 1 });
    await flushPendingTopline();

    assert.match(messages.join('\n'), /The monkey hits!.*The monkey takes off/s);
    assert.match(messages.join('\n'), /tries to run away with your/);
    assert.equal(monkey.mx, 11);
    assert.equal(monkey.my, 10);
    assert.equal(monkey.minvent.includes(hat), true);
});

for (const female of [true, false]) {
    void test(`a nymph ${female ? 'charms' : 'seduces'} the hero into handing over a cloak`, async () => {
        freshObjectRoom({ flags: { female }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const cloak = await addInventoryObject(LEATHER_CLOAK);
        wearHeroArmor(cloak);
        const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        nymph.mux = game.u.ux;
        nymph.muy = game.u.uy;
        const input = resetInputState();
        installPagerInput(input, { expected: /nymph|She/, limit: 12 });
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };

        await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });
        await flushPendingTopline();

        assert.match(messages.join('\n'), female
            ? /The water nymph charms you\.  You gladly hand over your cloak\./
            : /The beautiful water nymph seduces you and you take off your cloak\./);
        assert.equal(nymph.minvent.includes(cloak), true);
    });
}

void test('a nymph waits while the hero removes a suit, then steals it', async () => {
    freshObjectRoom({ flags: { female: true }, hero: { uhp: 100, uhpmax: 100, uac: 10 } });
    requirePlayingGame(game);
    const suit = await addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(suit);
    const nymph = await createMonsterAt('water nymph', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    nymph.mux = game.u.ux;
    nymph.muy = game.u.uy;
    const input = resetInputState();
    installPagerInput(input, { expected: /nymph|She/, limit: 24 });
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await performMonsterHeroAttack(nymph, game, { random: () => 0, rollOne: () => 1 });

    assert.equal(game.inventory.includes(suit), true, 'the suit stays carried during the removal delay');
    assert.equal(game.uarm, null);
    assert.match(game._pending_message + messages.join('\n'), /start removing your suit/);
    nymph.movement = -100;
    game._moveloopStarted = true;
    game.u.umovement = 12;
    let reads = 0;
    input.beforeRead = () => {
        if (++reads > 12) throw new Error(`Removal did not finish: ${JSON.stringify({
            delay: game._helplessTurns, moves: game.moves,
            multi: game.multi, movement: game.u.umovement, message: game._pending_message,
        })}`);
    };
    input.display = { async readKey() {
        messages.push(game._pending_message);
        const text = requireScreenRow(0).map(cell => cell.ch).join('');
        return text.includes('--More--') ? 32 : 46;
    } };
    while (game.multi < 0) await moveloop_core();
    await flushPendingTopline();
    assert.equal(nymph.minvent.includes(suit), true);
    assert.match(messages.join('\n'), /water nymph steals/);
});
