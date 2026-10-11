import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, W_AMUL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { initializePet } from '../js/dog.js';
import { heroHasConflict } from '../js/hero_conflict.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { plineWithContinuation } from '../js/display.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, RIN_CONFLICT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const conflict of [false, true]) {
    void test(`an adjacent hostile ${conflict ? 'fights its neighbor under Conflict before approaching the hero' : 'leaves its neighbor alone without Conflict'}`, async () => {
        freshObjectRoom({
            left: 10, right: 13, top: 10, bottom: 10,
            hero: { ulevel: 30 },
        });
        requirePlayingGame(game);
        if (conflict)
            await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
        assert.equal(heroHasConflict(game), conflict);
        const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
        const neighbor = await createMonsterAt('orc', 12, 10, NO_MINVENT);
        attacker.mpeaceful = 0;
        neighbor.mpeaceful = 0;
        const neighborHealth = neighbor.mhp;
        const heroHealth = game.u.uhp;
        initRng(1n);
        pushKeys(' '.repeat(40));
        await runMonsterAction(attacker, game);
        if (conflict) {
            assert.ok(neighbor.mhp < neighborHealth, 'the neighbor must receive the Conflict attack');
            assert.equal(game.u.uhp, heroHealth, 'a successful Conflict attack replaces ordinary hero combat');
        }
        else {
            assert.equal(neighbor.mhp, neighborHealth);
        }
    });
}
void test('Conflict selects the first adjacent monster in native order, including allies', async () => {
    freshObjectRoom({ hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
    const older = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    const newer = await createMonsterAt('orc', 11, 11, NO_MINVENT);
    initializePet(newer, { state: game });
    attacker.mpeaceful = 1;
    older.mpeaceful = 0;
    const olderHealth = older.mhp;
    const newerHealth = newer.mhp;
    initRng(1n);
    pushKeys(' '.repeat(40));
    await runMonsterAction(attacker, game);
    assert.ok(newer.mhp < newerHealth);
    assert.equal(older.mhp, olderHealth);
});
for (const blinded of [false, true]) {
    void test(`Conflict can drive a ${blinded ? 'blind' : 'sighted'} monster into combat`, async () => {
        freshObjectRoom({
            left: 10, right: 13, top: 10, bottom: 10,
            hero: { ulevel: 30 },
        });
        requirePlayingGame(game);
        await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
        const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
        const target = await createMonsterAt('orc', 12, 10, NO_MINVENT);
        attacker.mpeaceful = 0;
        if (blinded) {
            attacker.mcansee = 0;
            attacker.mblinded = 20;
        }
        const health = target.mhp;
        initRng(1n);
        pushKeys(' '.repeat(40));
        await runMonsterAction(attacker, game);
        assert.ok(target.mhp < health);
    });
}
void test('a paralyzed monster cannot start a Conflict attack', async () => {
    freshObjectRoom({ hero: { ulevel: 30 } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
    const target = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    attacker.mcanmove = 0;
    attacker.mfrozen = 10;
    const health = target.mhp;
    initRng(1n);
    pushKeys(' '.repeat(40));
    await runMonsterAction(attacker, game);
    assert.equal(target.mhp, health);
});
void test('a holder releases the hero for Conflict without starting a re-hold cooldown', async () => {
    freshObjectRoom({
        left: 10, right: 13, top: 10, bottom: 10,
        hero: { ulevel: 30 },
    });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const holder = await createMonsterAt('owlbear', 11, 10, NO_MINVENT);
    const target = await createMonsterAt('hill giant', 12, 10, NO_MINVENT);
    holder.mpeaceful = 0;
    target.mpeaceful = 0;
    game.u.ustuck = holder;
    assert.equal(holder.mspec_used ?? 0, 0);
    const health = target.mhp;
    await plineWithContinuation('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();
    initRng(7n);
    const fighting = runMonsterAction(holder, game);
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true),
        fighting.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'release feedback must wait for acknowledgement');
        assert.equal(Boolean(game.u.ustuck), false);
        assert.equal(target.mhp, health, 'combat must wait for the release message');
    }
    finally {
        input.feed(' '.repeat(50));
        await fighting;
    }
    assert.equal(Boolean(game.u.ustuck), false);
    assert.ok(target.mhp < health);
    assert.equal(holder.mspec_used ?? 0, 0);
});
void test('the turn driver completes a successful Conflict fight without a second hero attack', async () => {
    freshTurnRoom({ left: 10, right: 13, top: 10, bottom: 10 });
    requirePlayingGame(game);
    game.u.ulevel = 30;
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
    const target = await createMonsterAt('orc', 12, 10, NO_MINVENT);
    attacker.mpeaceful = 0;
    target.mpeaceful = 0;
    attacker.movement = 12;
    target.movement = 0;
    const targetHealth = target.mhp;
    const heroHealth = game.u.uhp;
    initRng(1n);
    pushKeys('m.' + ' '.repeat(40) + 'm.');
    await moveloop_core();
    await moveloop_core();
    assert.ok(target.mhp < targetHealth);
    assert.equal(game.u.uhp, heroHealth);
});
for (const nymph of [false, true]) {
    void test(`Conflict resistance uses ${nymph ? "a nymph form's minimum Charisma" : "the human hero's low Charisma"}`, async () => {
        freshObjectRoom({
            left: 10, right: 13, top: 10, bottom: 10,
            hero: { ulevel: 1, acurr: { a: [12, 12, 12, 12, 12, 3] } },
        });
        requirePlayingGame(game);
        await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
        const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
        const target = await createMonsterAt('orc', 12, 10, NO_MINVENT);
        attacker.mpeaceful = 0;
        target.mpeaceful = 0;
        if (nymph)
            installPolymorphedHero('wood nymph');
        const health = target.mhp;
        initRng(2n);
        pushKeys(' '.repeat(40));
        await runMonsterAction(attacker, game);
        if (nymph)
            assert.ok(target.mhp < health);
        else
            assert.equal(target.mhp, health);
    });
}
for (const movement of [0, 24]) {
    void test(`a Conflict defender ${movement ? 'spends a movement ration to retaliate' : 'cannot retaliate without movement'}`, async () => {
        freshObjectRoom({
            left: 10, right: 13, top: 10, bottom: 10,
            hero: { ulevel: 30 },
        });
        requirePlayingGame(game);
        await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
        const attacker = await createMonsterAt('human zombie', 11, 10, NO_MINVENT);
        const defender = await createMonsterAt('hill giant', 12, 10, NO_MINVENT);
        attacker.mpeaceful = 0;
        defender.mpeaceful = 0;
        defender.movement = movement;
        const attackerHealth = attacker.mhp;
        const defenderHealth = defender.mhp;
        initRng(6n);
        pushKeys(' '.repeat(50));
        await runMonsterAction(attacker, game);
        assert.ok(defender.mhp < defenderHealth);
        assert.equal(defender.movement, movement ? 12 : 0);
        if (movement)
            assert.ok(attacker.mhp < attackerHealth);
        else
            assert.equal(attacker.mhp, attackerHealth);
    });
}
void test('a zero-damage petrifying touch counts as a Conflict hit and permits retaliation', async () => {
    freshObjectRoom({
        left: 10, right: 13, top: 10, bottom: 10,
        hero: { ulevel: 30 },
    });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const attacker = await createMonsterAt('cockatrice', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('stone golem', 12, 10, NO_MINVENT);
    attacker.mpeaceful = 0;
    defender.mpeaceful = 0;
    defender.movement = 24;
    const defenderHealth = defender.mhp;
    const attackerHealth = attacker.mhp;
    const heroHealth = game.u.uhp;
    initRng(3n);
    pushKeys(' '.repeat(50));
    await runMonsterAction(attacker, game);
    assert.equal(defender.mhp, defenderHealth);
    assert.equal(defender.movement, 12);
    assert.ok(attacker.mhp < attackerHealth);
    assert.equal(game.u.uhp, heroHealth);
    assert.equal(game.u.stonedTurns ?? 0, 0);
});
void test('a missed Conflict attack still ends the action when a fatal passive triggers life saving', async () => {
    freshObjectRoom({
        left: 10, right: 13, top: 10, bottom: 10,
        hero: { ulevel: 30 },
    });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const attacker = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('fire elemental', 12, 10, NO_MINVENT);
    attacker.mpeaceful = 0;
    defender.mpeaceful = 0;
    const amulet = await equipMonsterObject(attacker, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    attacker.mhp = 1;
    const defenderHealth = defender.mhp;
    const heroHealth = game.u.uhp;
    initRng(5n);
    pushKeys(' '.repeat(50));
    await runMonsterAction(attacker, game);
    assert.equal(defender.mhp, defenderHealth, 'the triggering attack missed');
    assert.equal(attacker.minvent.includes(amulet), false);
    assert.ok(attacker.mhp > 0);
    assert.equal(Boolean(attacker.dead), false);
    assert.equal(game.u.uhp, heroHealth, 'life saving must not grant another attack');
});
//# sourceMappingURL=monster_conflict.test.js.map