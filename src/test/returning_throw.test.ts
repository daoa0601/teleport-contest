import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AKLYS, BOOMERANG } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryItem } from '../js/u_init.js';
import { rhack } from '../js/cmd.js';
import { pushKey } from '../js/input.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryWeapon, artifactObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

async function wieldAklys() {
    freshObjectRoom({ left: 4, right: 25, top: 3, bottom: 17 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 125;
    const weapon = await addInventoryWeapon(AKLYS);
    await setPrimaryWeapon(weapon, game);
    return weapon;
}

void test('a wielded aklys returns to the primary slot after a horizontal throw', async () => {
    const weapon = await wieldAklys();
    initRng(1n);

    await throwInventoryObject(weapon, 'l');

    assert.equal(game.uwep, weapon);
    assert.equal(weapon.where, 'inventory');
    assert.equal(game.uquiver, null);
    assert.match(game._pending_message, /The aklys returns to your hand!/);
});

void test('fire throws and catches the wielded aklys without a quiver', async () => {
    const weapon = await wieldAklys();
    initRng(1n);
    pushKey('l');

    await rhack('f'.charCodeAt(0));

    assert.equal(game.uwep, weapon);
    assert.equal(weapon.where, 'inventory');
    assert.equal(game.context.move, 1);
});

void test('a detached tether leaves an aklys no more than four squares away', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    const level = game.level;
    initRng(167n);

    await throwInventoryObject(weapon, 'l');

    assert.equal(game.uwep, null);
    assert.ok(floorObjectsAt(level, 14, 10).includes(weapon));
    assert.match(game._pending_message, /The aklys fails to return!/);
});

void test('a failed catch leaves the returning aklys at the hero', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    initRng(26n);

    await throwInventoryObject(weapon, 'l', ' '.repeat(10));

    assert.equal(game.uwep, null);
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(weapon));
    assert.match(game._pending_message, /(?:landing at your feet|hitting your arm)/);
});

void test('fumbling prevents a returning aklys catch', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    game.u.fumbling = true;
    initRng(1n);

    await throwInventoryObject(weapon, 'l', ' '.repeat(10));

    assert.equal(game.uwep, null);
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(weapon));
});

void test('a web prevents the aklys from returning', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    addTrap(game.level, WEB, 11, 10);
    initRng(1n);

    await throwInventoryObject(weapon, 'l', ' '.repeat(10));

    assert.equal(weapon.where, 'floor');
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(weapon));
    assert.match(game._pending_message, /gets stuck in a web!/);
});

void test('a strong Valkyrie catches and rewields Mjollnir', async () => {
    freshObjectRoom({ role: 'valkyrie', right: 25 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 125;
    const hammer = await addInventoryItem(await artifactObject('Mjollnir'));
    await setPrimaryWeapon(hammer, game);
    initRng(1n);

    await throwInventoryObject(hammer, 'l');

    assert.equal(game.uwep, hammer);
    assert.equal(hammer.where, 'inventory');
    assert.match(game._pending_message, /Mjollnir returns to your hand!/);
});

for (const kill of [false, true]) {
    void test(`a swallowed aklys returns after ${kill ? 'killing' : 'hitting'} its engulfer`, async () => {
        const weapon = await wieldAklys();
        requirePlayingGame(game);
        const engulfer = await createMonsterAt('trapper', 11, 10);
        engulfer.mx = 10;
        engulfer.mhp = kill ? 1 : 100;
        engulfer.mhpmax = 100;
        game.u.uswallow = 1;
        game.u.ustuck = engulfer;
        initRng(1n);

        await throwInventoryObject(weapon, 'l', ' '.repeat(30));

        assert.ok(engulfer.mhp < (kill ? 1 : 100));
        assert.equal(game.uwep, weapon);
        assert.equal(weapon.where, 'inventory');
        assert.ok(!engulfer.minvent.includes(weapon));
    });
}

void test('an underwater boomerang takes the straight returning-weapon path', async () => {
    freshObjectRoom({ right: 25 });
    requirePlayingGame(game);
    game.underwater = true;
    const boom = await addInventoryWeapon(BOOMERANG);
    initRng(1n);

    await throwInventoryObject(boom, 'l');

    assert.equal(boom.where, 'inventory');
    assert.equal(game.uwep, boom);
    assert.match(game._pending_message, /The boomerang returns to your hand!/);
});

void test('an unwielded aklys has no tether or automatic return', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    await setPrimaryWeapon(null, game);
    initRng(1n);

    await throwInventoryObject(weapon, 'l');

    assert.equal(weapon.where, 'floor');
    assert.ok(weapon.ox > 14);
});

void test('Glib does not prevent catching an aklys in the pinned throwit rules', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    game.u.glib = true;
    game.u.glibTurns = 10;
    initRng(1n);

    await throwInventoryObject(weapon, 'l');

    assert.equal(game.uwep, weapon);
    assert.equal(weapon.where, 'inventory');
});

void test('a blind thrower hears no return description when an aklys lands at their feet', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    game.u.blind = true;
    game.u.blindTurns = 10;
    initRng(1n);

    await throwInventoryObject(weapon, 'l');

    assert.equal(game._pending_message, 'Something lands at your feet.');
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(weapon));
});

void test('half physical damage reduces a failed catch injury', async () => {
    const weapon = await wieldAklys();
    requirePlayingGame(game);
    initRng(26n);
    await throwInventoryObject(weapon, 'l');
    const fullDamage = 40 - game.u.uhp;
    assert.ok(fullDamage >= 2 && fullDamage <= 4);

    const protectedWeapon = await wieldAklys();
    requirePlayingGame(game);
    game.u.halfPhysicalDamage = true;
    initRng(26n);
    await throwInventoryObject(protectedWeapon, 'l');

    assert.equal(40 - game.u.uhp, Math.ceil(fullDamage / 2));
});

void test('a failed Mjollnir catch can strike the hero with lightning', async () => {
    freshObjectRoom({ role: 'valkyrie', right: 25 });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = 125;
    const hammer = await addInventoryItem(await artifactObject('Mjollnir'));
    await setPrimaryWeapon(hammer, game);
    initRng(26n);

    await throwInventoryObject(hammer, 'l', ' '.repeat(20));

    assert.ok(game.u.uhp < 36);
    assert.match(game._pending_message, /Lightning strikes you!/);
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(hammer));
});
