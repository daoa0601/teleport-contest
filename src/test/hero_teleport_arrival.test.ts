import { createDungeon, createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addBuriedObject } from '../js/buried_object.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { askTeleportDestination } from '../js/cmd.js';
import { A_STR, HOLE, M_AP_NOTHING, PIT, VIBRATING_SQUARE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flush_screen, newsym } from '../js/display.js';
import { useHeroHide } from '../js/hero_hide.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { pushKeys } from '../js/input.js';
import { BOULDER, DIAMOND, RIN_TELEPORT_CONTROL } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { races } from '../js/roles.js';
import { moveHeroByTeleport, teleportHero } from '../js/teleport.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import {
    installHeroChainedToBuriedBall, installPolymorphedHero,
} from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { requireScreenCell } from './support/screen.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';

void test('relocation refreshes a blind hero warning range before arrival effects', async () => {
    freshObjectRoom({ right: 24 });
    requirePlayingGame(game);
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    grantIntrinsicProperty('warning', 'outside');
    const wight = await createMonsterAt('barrow wight', 21, 10);
    newsym(wight.mx, wight.my);
    await flush_screen(1);
    assert.notEqual(requireScreenCell(20, 11).ch, '1');

    await moveHeroByTeleport(12, 10);
    await flush_screen(1);

    assert.equal(requireScreenCell(20, 11).ch, '1');
});

void test('teleport unearths a chained ball and carries the restored punishment', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const ball = await installHeroChainedToBuriedBall();

    await moveHeroByTeleport(14, 10);

    assert.equal(game.uball, ball);
    assert.ok(game.uchain);
    assert.ok(game.level.buriedObjects != null);
    assert.equal(game.level.buriedObjects.includes(ball), false);
    assert.equal(ball.where, 'floor');
    assert.deepEqual([ball.ox, ball.oy], [14, 10]);
    assert.deepEqual([game.uchain.ox, game.uchain.oy], [14, 10]);
    assert.equal(game.u.utrap, 0);
});

for (const trapType of [PIT, HOLE] as const) {
    void test(`relocation ${trapType === PIT ? 'fills an old pit' : 'does not fill an old hole'} beneath a boulder`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const trap = addTrap(game.level, trapType, 10, 10);
        const boulder = await floorObject(BOULDER, 10, 10);

        await moveHeroByTeleport(14, 10);

        assert.equal(game.level.traps.includes(trap), trapType !== PIT);
        assert.equal(boulder.where === 'gone', trapType === PIT);
    });
}

for (const form of ['large mimic', 'cave spider'] as const) {
    void test(`relocation reveals a hidden ${form}, even with cover at the destination`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        installPolymorphedHero(form);
        await floorObject(DIAMOND, 10, 10);
        await floorObject(DIAMOND, 14, 10);
        pushKeys(' '.repeat(20));
        await useHeroHide();
        assert.ok(game.u.uundetected || game.u.m_ap_type);

        await moveHeroByTeleport(14, 10);

        assert.equal(game.u.uundetected, 0);
        if (form === 'large mimic') assert.equal(game.u.m_ap_type, M_AP_NOTHING);
    });
}

void test('relocation does not wake a sleeping hero or shorten the sleep', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    putHeroToSleep(8);
    const sleepingSince = game.u.usleep;

    await moveHeroByTeleport(14, 10);

    assert.equal(game._helplessTurns, 8);
    assert.equal(game.u.usleep, sleepingSince);
});

for (const condition of ['grounded', 'levitating', 'polymorphed'] as const) {
    void test(`a ${condition} dwarf ${condition === 'grounded' ? 'senses' : 'cannot sense'} buried objects after relocation`, async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const dwarf = races.find(race => race.name === 'dwarf');
        assert.ok(dwarf);
        game.urace = dwarf;
        const gem = await floorObject(DIAMOND, 14, 10);
        addBuriedObject(gem, 14, 10);
        if (condition === 'levitating') grantIntrinsicProperty('levitation', 'outside');
        if (condition === 'polymorphed') installPolymorphedHero('giant spider');
        pushKeys(' '.repeat(20));

        await moveHeroByTeleport(14, 10);

        if (condition === 'grounded')
            assert.match(game._pending_message, /You sense something below your feet\./);
        else assert.doesNotMatch(game._pending_message || '', /sense something below/);
        assert.equal(gem.where, 'buried');
        assert.ok(game.level.buriedObjects != null);
        assert.equal(game.level.buriedObjects.includes(gem), true);
    });
}

void test('a completed teleport announces the invocation square after revealing its trap', async () => {
    freshObjectRoom({ flags: { debug: true, tips: false } });
    requireFixtureGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ num_dunlevs: 30, flags: { hellish: true } } })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    game.u.uz = { dnum: 0, dlevel: 29 };
    const square = addTrap(game.level, VIBRATING_SQUARE, 12, 10, { tseen: false });
    pushKeys('ll.' + ' '.repeat(20));

    const result = await teleportHero({ chooseDestination: askTeleportDestination });

    assert.equal(result.moved, true);
    assert.equal(result.died, false);
    assert.equal(square.tseen, true);
    assert.ok(game.u.uevent != null);
    assert.equal(game.u.uevent.uvibrated, 1);
    assert.match(game._pending_message, /You feel a strange vibration under your feet\./);
});

void test('natural teleport needs no at-will level, Strength, hunger, or energy', async () => {
    freshObjectRoom({
        flags: { tips: false },
        hero: { ulevel: 1, uen: 0, uhunger: 2 },
    });
    requireFixtureGame(game);
    game.u.acurr.a[A_STR] = 3;
    await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
    pushKeys('llll.' + ' '.repeat(20));

    const result = await teleportHero({ chooseDestination: askTeleportDestination });

    assert.equal(result.moved, true);
    assert.equal(result.died, false);
    assert.equal(game.u.ux, 14);
    assert.equal(game.u.uhunger, 2);
    assert.equal(game.u.uen, 0);
});

void test('natural teleport obeys the level restriction before choosing a destination', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.flags.noteleport = true;

    const result = await teleportHero();

    assert.equal(result.moved, false);
    assert.equal(game.u.ux, 10);
    assert.match(game._pending_message, /A mysterious force prevents you from teleporting!/);
});

void test('cancelling natural controlled teleport does not run arrival or charge resources', async () => {
    freshObjectRoom({ flags: { tips: false, pickup: true } });
    requireFixtureGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
    const gem = await floorObject(DIAMOND, 10, 10);
    const hunger = game.u.uhunger;
    const energy = game.u.uen;
    pushKeys('\x1b');

    const result = await teleportHero({ chooseDestination: askTeleportDestination });

    assert.equal(result.moved, false);
    assert.equal(game.u.ux, 10);
    assert.equal(gem.where, 'floor');
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uen, energy);
});

void test('choosing the current square is a teleport and still completes pickup', async () => {
    freshObjectRoom({ flags: { tips: false, pickup: true } });
    requireFixtureGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
    const gem = await floorObject(DIAMOND, 10, 10);
    pushKeys('.' + ' '.repeat(20));

    const result = await teleportHero({ chooseDestination: askTeleportDestination });

    assert.equal(result.moved, true);
    assert.equal(game.u.ux, 10);
    assert.equal(game.inventory.includes(gem), true);
});

void test('a conscious paralyzed hero can still choose a teleport destination', async () => {
    freshObjectRoom({ flags: { tips: false } });
    requireFixtureGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_TELEPORT_CONTROL), 'uleft');
    game._helplessTurns = 8;
    game._helplessReason = 'paralyzed by a monster';
    game._helplessDoneMessage = 'You can move again.';
    pushKeys('llll.' + ' '.repeat(20));

    const result = await teleportHero({ chooseDestination: askTeleportDestination });

    assert.equal(result.moved, true);
    assert.equal(game.u.ux, 14);
    assert.equal(game._helplessTurns, 8);
});
