import assert from 'node:assert/strict';
import test from 'node:test';
import { STR19 } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { HELMET, LONG_SWORD } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject, addInventoryWeapon, artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('falling Mjollnir wakes sleepers near the map origin rather than the hero', async () => {
    freshObjectRoom({
        left: 1, top: 1,
        hero: { acurr: { a: [STR19(25), 12, 12, 12, 12, 12] } },
    });
    const nearOrigin = await createMonsterAt('goblin', 1, 1);
    const beyondOriginRadius = await createMonsterAt('goblin', 3, 3);
    const nearHero = await createMonsterAt('goblin', 11, 10);
    for (const monster of [nearOrigin, beyondOriginRadius, nearHero]) monster.msleeping = 1;
    const hammer = await addInventoryItem(await artifactObject('Mjollnir', { spe: 0 }));
    await setPrimaryWeapon(hammer);

    await throwInventoryObject(hammer, '<', ' '.repeat(30));

    assert.equal(hammer.where, 'floor', 'Mjollnir must fall back onto the hero');
    assert.equal(nearOrigin.msleeping, 0, 'lightning wakes monsters within four squares of (0, 0)');
    assert.equal(beyondOriginRadius.msleeping, 1, 'the wake-up radius excludes squared distances of 16 or more');
    assert.equal(nearHero.msleeping, 1, 'the hero position does not center this lightning wake-up');
});

void test('Excalibur falling onto the hero adds its artifact damage to ordinary sword damage', async () => {
    const wounds: number[] = [];
    for (const artifact of [false, true]) {
        freshObjectRoom();
        requirePlayingGame(game);
        const sword = artifact
            ? await addInventoryItem(await artifactObject('Excalibur', { spe: 0 }))
            : await addInventoryWeapon(LONG_SWORD);
        initRng(42n);

        await throwInventoryObject(sword, '<', ' '.repeat(30));

        wounds.push(40 - game.u.uhp);
        assert.equal(sword.where, 'floor');
    }
    const ordinary = wounds[0];
    const artifact = wounds[1];
    assert.ok(ordinary !== undefined && artifact !== undefined);
    assert.ok(artifact > ordinary && artifact <= ordinary + 10,
        `ordinary sword caused ${ordinary} damage; Excalibur caused ${artifact}`);
});

void test('a falling Fire Brand burns away slime and replaces the hard helmet reassurance', async () => {
    freshObjectRoom({ hero: { slimedTurns: 10 } });
    const helmet = await addInventoryObject(HELMET);
    game.uarmh = game.u.uarmh = helmet;
    const sword = await addInventoryItem(await artifactObject('Fire Brand', { spe: 0 }));
    const messages: string[] = [];
    resetInputState().beforeRead = () => { messages.push(game._pending_message); };

    await throwInventoryObject(sword, '<', ' '.repeat(30));

    const text = messages.join('\n') + '\n' + game._pending_message;
    assert.match(text, /The fiery blade burns you!/);
    assert.doesNotMatch(text, /Fortunately, you are wearing a hard helmet/);
    assert.equal(game.u.slimedTurns, 0);
    assert.equal(game.u.uhp, 39);
});

void test('a falling Stormbringer drains the hero experience level', async () => {
    freshObjectRoom();
    const sword = await addInventoryItem(await artifactObject('Stormbringer', { spe: 0 }));

    await throwInventoryObject(sword, '<', ' '.repeat(30));

    assert.equal(game.u.ulevel, 7);
    assert.equal(sword.where, 'floor');
});

void test('a falling Magicbane can cancel the hero and drain magical energy', async () => {
    let cancelled = false;
    for (let seed = 1; seed <= 24 && !cancelled; seed++) {
        freshObjectRoom({ hero: { uen: 10, uenmax: 10 } });
        const blade = await addInventoryItem(await artifactObject('Magicbane', { spe: 0 }));
        initRng(BigInt(seed));

        await throwInventoryObject(blade, '<', ' '.repeat(30));

        if (game.u.uenmax === 9) {
            assert.equal(game.u.uen, 9);
            cancelled = true;
        }
    }
    assert.ok(cancelled, 'an unresisted falling Magicbane must sometimes cancel and drain energy');
});
