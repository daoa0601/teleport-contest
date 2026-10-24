import test from 'node:test';
import assert from 'node:assert/strict';

import { useBullwhip } from '../js/bullwhip.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { TT_PIT, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, BULLWHIP, CLUB, CORPSE, CRYSKNIFE, DAGGER, ROCK } from '../js/object_data.js';
import { objectQuantity } from '../js/object_stack.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { UNENCUMBERED, nearCapacity, objectWeight } from '../js/weight.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { floorObjectsAt } from './support/level-state.js';

void test('applying an unwielded bullwhip wields it before asking for direction', async () => {
    freshPlayableRoom({ role: 'archeologist' });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
    });
    initRng(7101n);
    await applyInventoryObject(whip, ' l'); // Acknowledge wielding before the direction query.

    assert.equal(game.uwep, whip);
    assert.equal(game.context.move, 1);

    await rhack(0);

    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /Snap/);
});

void test('an archeologist can pull a wielded weapon from an adjacent monster', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    const club = await knownObject(CLUB, {});
    const bugbear = await createMonsterAt('bugbear', 11, 10);
    await equipMonsterObject(bugbear, club, W_WEP);
    initRng(7102n);
    await applyInventoryObject(whip, 'l ');

    assert.equal(bugbear.mw, null);
    assert.equal(bugbear.minvent.includes(club), false);
    assert.equal(game.context.move, 1);
});

void test('a proficient bullwhip can pull the hero from a pit toward a boulder', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    await floorObject(BOULDER, 11, 10);
    initRng(7103n);
    await applyInventoryObject(whip, 'l ');

    assert.equal(game.u.utrap, 0);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
});

// C apply.c:3174-3231: the disarm extracts the weapon raw
// (obj_extract_self, no unwear owner, no crysknife release); case 3
// snatches it straight into the hero's pack.  An UNPROOFED crysknife
// therefore stays a crysknife in hero inventory — zero releases ran.
void test('snatching an unproofed crysknife keeps it a crysknife in the pack', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    const knife = await knownObject(CRYSKNIFE, {
        oerodeproof: false,
    });
    const bugbear = await createMonsterAt('bugbear', 11, 10);
    await equipMonsterObject(bugbear, knife, W_WEP);
    initRng(7102n);
    await applyInventoryObject(whip, 'l ');

    assert.equal(bugbear.mw, null);
    assert.ok(game.inventory.includes(knife));
    assert.equal(knife.otyp, CRYSKNIFE);
    assert.equal((requireGameLevel().objects[game.u.ux]?.[game.u.uy] || []).includes(knife), false);
});

void test('a whip cannot acquire a floor stack when the hero is overloaded', async () => {
    freshPlayableRoom({ role: 'archeologist' });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    game.u.levitating = true;
    await addInventoryObject(BOULDER, { quantity: 4 });
    const clubs = await floorObject(CLUB, 10, 10, { quantity: 3 });
    for (let seed = 1n; seed <= 30n; seed++) {
        initRng(seed);
        pushKeys(' '.repeat(8));
        await useBullwhip(whip, { dx: 0, dy: 0, dz: 1 });
        assert.equal(clubs.quan, 3);
        assert.equal(game.inventory.some(object => object.otyp === CLUB), false);
    }
});

void test('a whip revives a Rider corpse with remote acquisition feedback', async () => {
    const level = freshPlayableRoom({ role: 'archeologist', hero: { levitating: true } });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    const rider = MONSTER_NAME.indexOf('Death');
    assert.ok(rider >= 0, 'Death must have a monster species.');
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: rider });
    vision_recalc(0);
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };

    for (let seed = 1n; seed <= 30n && floorObjectsAt(level, 10, 10).includes(corpse); seed++) {
        initRng(seed);
        pushKeys(' '.repeat(8));
        await useBullwhip(whip, { dx: 0, dy: 0, dz: 1 });
    }

    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(floorObjectsAt(level, 10, 10).includes(corpse), false);
    assert.ok(level.monsters.some(monster => monster.mnum === rider && monster.mhp > 0));
    assert.match(messages.join('\n'),
        /At your attempted acquisition, the corpse suddenly moves\.\.\./);
});

// C apply.c:3230 hands a snatched weapon to invent.c:hold_another_object(),
// whose fumbling, slot, and burden refusals drop it at the hero's feet.
async function snatchClubFromBugbear(prepare: () => Promise<void> | void) {
    for (let seed = 1n; seed <= 200n; seed++) {
        const level = freshPlayableRoom({
            role: 'archeologist',
            hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
        });
        requirePlayingGame(game);
        const whip = await addInventoryObject(BULLWHIP, {
            invlet: 'a', spe: 2, wielded: true, owornmask: W_WEP,
        });
        game.uwep = game.u.uwep = whip;
        await prepare();
        const club = await knownObject(CLUB, {});
        const bugbear = await createMonsterAt('bugbear', 11, 10);
        await equipMonsterObject(bugbear, club, W_WEP);
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        initRng(seed);
        pushKeys(' '.repeat(8));
        await useBullwhip(whip, { dx: 1, dy: 0, dz: 0 });
        messages.push(game._pending_message);
        const text = messages.join('\n');
        if (/You snatch/u.test(text)) return { club, level, text };
    }
    throw new Error('No seed reached the bullwhip snatch.');
}

function assertDroppedAtFeet(result: Awaited<ReturnType<typeof snatchClubFromBugbear>>) {
    assert.equal(game.inventory.includes(result.club), false);
    assert.ok(floorObjectsAt(result.level, game.u.ux, game.u.uy).includes(result.club));
    assert.match(result.text, /You drop [^\n]*club!/u);
}

void test('a snatched weapon is dropped when every inventory slot is taken', async () => {
    const result = await snatchClubFromBugbear(async () => {
        const letters = 'bcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const [index, invlet] of [...letters].entries())
            await addInventoryObject(DAGGER, { invlet, spe: index - 25 });
    });
    assertDroppedAtFeet(result);
});

void test('a snatched weapon is dropped when it would exceed the pickup burden', async () => {
    const result = await snatchClubFromBugbear(async () => {
        game.flags.pickup_burden = UNENCUMBERED;
        const rocks = await addInventoryObject(ROCK, { quantity: 1 });
        const setRocks = (count: number) => {
            rocks.quan = rocks.quantity = count;
            rocks.owt = objectWeight(rocks);
        };
        while (nearCapacity(game) === UNENCUMBERED) setRocks(objectQuantity(rocks) + 1);
        setRocks(objectQuantity(rocks) - 1);
        assert.equal(nearCapacity(game), UNENCUMBERED);
    });
    assertDroppedAtFeet(result);
});

void test('a fumbling hero drops a snatched weapon', async () => {
    const result = await snatchClubFromBugbear(() => {
        grantIntrinsicProperty('fumbling', 'outside', game);
    });
    assertDroppedAtFeet(result);
});

void test('slippery fingers do not stop a snatched weapon from being held', async () => {
    const result = await snatchClubFromBugbear(() => { game.u.glibTurns = 20; });
    assert.ok(game.inventory.includes(result.club));
    assert.match(result.text, /[a-zA-Z] - [^\n]*club/u);
});
