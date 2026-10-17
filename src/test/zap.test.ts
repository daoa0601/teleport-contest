import { armorBaseBonus } from '../js/armor.js';
import { findMonsterArmorClass } from '../js/monworn.js';
import { W_ARM } from '../js/const.js';
import { LEATHER_ARMOR } from '../js/object_data.js';
import { roles } from '../js/roles.js';
import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import { planInput } from './support/planned-input.js';
import assert from 'node:assert/strict';

import {
    COULD_SEE, DOOR, D_CLOSED, D_NODOOR, ICE, ICED_POOL, IS_POOL, PIT,
    POOL, ROOM, SDOOR, STONE, W_AMUL, WEB,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { meltIce } from '../js/ice.js';
import { pushKey, pushKeys, resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import {
    AMULET_OF_LIFE_SAVING, APPLE, OIL_LAMP, POT_ACID, SCR_IDENTIFY,
    WAN_CANCELLATION, WAN_CREATE_MONSTER, WAN_DIGGING,
    WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_SECRET_DOOR_DETECTION,
    WAN_SLEEP, WAN_STASIS, WAN_WISHING, WAN_DEATH, WAN_COLD,
} from '../js/object_data.js';
import {
    LEVEL_TIMER_KIND, scheduleLevelTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { heroTeleportRestricted } from '../js/teleport_rules.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import {
    zapRayWithObject,
} from '../js/zap.js';
import { applyWandEffect } from '../js/wand_effects.js';
import {
    addInventoryObject, chargedWand, floorObject, knownObject,
} from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('a digging zap changes terrain without retaining its answered direction query', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = STONE;
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 2 });
    pushKeys(`${wand.invlet}l`);

    await rhack('z'.charCodeAt(0));
    await flush_screen(1);

    assert.notEqual(level.requireAt(11, 10).typ, STONE);
    assert.equal(wand.spe, 1);
    assert.equal(game.context.move, 1);
    const message = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    assert.equal(message, '');
});

void test('using an identified wand leaves its remaining charge count visible', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const wand = await chargedWand(WAN_LIGHT, { charges: 2 });
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.match(inventoryItemDescription(wand), /\(0:1\)/);
});

void test('sleep resistance prevents self-zap helplessness', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const healer = roles.find(role => role.key === 'healer');
    assert.ok(healer);
    game.urole = healer;
    game.u.sleepResistance = true;
    const wand = await chargedWand(WAN_SLEEP);
    game.inventory = [wand];
    pushKey('a');
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(wand.spe, 2);
    assert.equal(wand.typeKnown, true);
    assert.equal(game._helplessTurns, undefined);
    assert.equal(game._pending_message, "You don't feel sleepy!");
    assert.equal(game.context.move, 1);
});

void test('cancellation restores a werewolf to human form', async t => {
    freshGameplayRoom();
    planInput(resetInputState(), t, []);
    requirePlayingGame(game);
    const werewolf = await createMonsterAt('werewolf', 11, 10);

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await applyWandEffect(await chargedWand(WAN_CANCELLATION));

    assert.equal(werewolf.mnum, 263);
    assert.equal(werewolf.mcan, 1);
});

void test('cancellation destroys a clay golem', async t => {
    freshGameplayRoom();
    planInput(resetInputState(), t, [{ prompt: /writing vanishes from the clay golem/, keys: ' ' }]);
    requirePlayingGame(game);
    const golem = await createMonsterAt('clay golem', 11, 10);

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await applyWandEffect(await chargedWand(WAN_CANCELLATION));

    assert.equal(golem.dead, true);
    assert.equal(game.level.monsters.includes(golem), false);
});

void test('an empty wand does nothing without asking for a direction', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    const wand = await chargedWand(WAN_SLEEP, { charges: 0 });
    game.inventory = [wand];
    initRng(1n);
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), true);
    assert.equal(wand.spe, 0);
    assert.equal(game._pending_message, 'Nothing happens.');
    assert.equal(game.context.move, 1);
});

void test('a wrested final charge consumes the wand', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.sleepResistance = true;
    const wand = await chargedWand(WAN_SLEEP, { charges: 0 });
    game.inventory = [wand];
    initRng(49n);
    pushKey('a');
    pushKey(' '); // Acknowledge wresting the charge before choosing a direction.
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), false);
    assert.equal(wand.where, 'gone');
    assert.equal(game.context.move, 1);
});

void test('a cursed wand can explode before asking for a direction', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const wand = await chargedWand(WAN_SLEEP, { cursed: true });
    game.inventory = [wand];
    initRng(167n);
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), false);
    assert.ok(game.u.uhp < 100);
    assert.equal(game.context.move, 1);
});

void test('secret door detection reveals nearby hidden terrain and traps', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    const hiddenDoor = level.requireAt(12, 10);
    hiddenDoor.typ = SDOOR;
    hiddenDoor.doormask = 0;
    const hiddenTrap = addTrap(level, WEB, 11, 11, { tseen: false });
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][12] = (game.viz_array[10][12] ?? 0) | COULD_SEE;
    assert.ok(game.viz_array[11] != null);
    game.viz_array[11][11] = (game.viz_array[11][11] ?? 0) | COULD_SEE;
    const wand = await chargedWand(WAN_SECRET_DOOR_DETECTION);
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(hiddenDoor.typ, DOOR);
    assert.equal(hiddenDoor.doormask, D_CLOSED);
    assert.equal(hiddenTrap.tseen, true);
    assert.equal(wand.typeKnown, true);
});

void test('light illuminates the visible area and burns a nearby gremlin',
    async () => {
        const level = freshGameplayRoom();
        requirePlayingGame(game);
        for (let x = 8; x <= 18; x++) {
            for (let y = 8; y <= 12; y++) level.requireAt(x, y).lit = false;
        }
        vision_reset_new_level();
        vision_recalc(0);
        const gremlin = await createMonsterAt('gremlin', 11, 10);
        gremlin.mhp = gremlin.mhpmax = 20;
        const wand = await chargedWand(WAN_LIGHT);
        game.inventory = [wand];
        pushKey('a');

        await rhack('z'.charCodeAt(0));

        assert.equal(level.requireAt(11, 10).lit, true);
        assert.equal(level.requireAt(18, 10).lit, false);
        assert.ok(gremlin.mhp < 20);
    });

void test('stasis blocks teleporting until its turns expire', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.moves = 100;
    const wand = await chargedWand(WAN_STASIS);
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(heroTeleportRestricted(), true);
    assert.ok(game.level.flags.stasis_until != null, 'Expected game.level.flags.stasis_until to be initialized');
    game.moves = game.level.flags.stasis_until + 1;
    assert.equal(heroTeleportRestricted(), false);
});

void test('create monster summons beside the hero without asking for a direction',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        const wand = await chargedWand(WAN_CREATE_MONSTER);
        game.inventory = [wand];
        pushKey('a');

        await rhack('z'.charCodeAt(0));

        assert.ok(game.level.monsters.length > 0);
    });

void test('wishing creates the requested object without asking for a direction',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.u.uluck = 10;
        const wand = await chargedWand(WAN_WISHING);
        game.inventory = [wand];
        pushKey('a');
        pushKey(' ');
        pushKeys('apple\n');

        await rhack('z'.charCodeAt(0));

        assert.ok(game.inventory.some(object => object.otyp === APPLE));
    });

void test('enlightenment describes the hero without asking for a direction',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.plname = 'Zapper';
        const wand = await chargedWand(WAN_ENLIGHTENMENT);
        game.inventory = [wand];
        const input = resetInputState();
        assert.ok(wand.invlet);
        input.feed(wand.invlet);

        const zapping = rhack('z'.charCodeAt(0));
        await input.waitUntilBlocked();
        const greeting = requireScreenRow(0).map(cell => cell.ch).join('');
        input.feed(' ');
        await input.waitUntilBlocked();
        const attributes = requireScreenRow(0).map(cell => cell.ch).join('');
        input.feed(' ');
        await zapping;

        assert.match(greeting, /You feel self-knowledgeable\.\.\.--More--/);
        assert.match(attributes, /Zapper the Caveman's attributes/);
        assert.equal(game._pending_message, 'The feeling subsides.');
        assert.equal(wand.spe, 2);
        assert.equal(game.context.move, 1);
    });

void test('a fire ray burns a monster in its path', async t => {
    freshGameplayRoom();
    planInput(resetInputState(), t, []);
    requirePlayingGame(game);
    game.u.fireResistance = true;
    game.u.uhp = game.u.uhpmax = 100;
    const monster = await createMonsterAt('giant ant', 11, 10);
    monster.m_lev = 1;
    monster.mhp = 100;
    monster.mhpmax = 100;
    monster.msleeping = 1;
    monster.mstrategy = 0x20000000;
    const wand = await chargedWand(WAN_FIRE);
    game.inventory = [wand];
    pushKey('a');
    pushKey('l');

    await rhack('z'.charCodeAt(0));

    assert.ok(monster.mhp < 100);
    assert.equal(monster.msleeping, 0);
    assert.equal(wand.typeKnown, true);
    assert.equal(game.context.move, 1);
});

void test('a death ray makes Death stronger instead of killing him', async () => {
    freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.u.blindTurns = 10;
    game.u.unblind_telepat_range = -1;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    const death = await createMonsterAt('Death', 11, 10);
    const armor = await knownObject(LEATHER_ARMOR, { initialize: false,
        spe: findMonsterArmorClass(death) - armorBaseBonus(LEATHER_ARMOR) - 30 });
    await equipMonsterObject(death, armor, W_ARM);
    assert.equal(findMonsterArmorClass(death), 30);
    death.m_lev = 30;
    death.mhp = 5;
    death.mhpmax = 20;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_DEATH));

    assert.equal(death.mhp, 30);
    assert.equal(death.mhpmax, 30);
    assert.ok(game.level.monsters.includes(death));
});

void test('a worn life-saving amulet saves a monster from a death ray', async t => {
    freshGameplayRoom();
    planInput(resetInputState(), t, [
        { prompt: /kill the goblin.*But wait/, keys: ' ' },
        { prompt: /goblin.s medallion begins to glow!  The goblin looks much better!/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    const monster = await createMonsterAt('goblin', 11, 10);
    const armor = await knownObject(LEATHER_ARMOR, { initialize: false,
        spe: findMonsterArmorClass(monster) - armorBaseBonus(LEATHER_ARMOR) - 30 });
    await equipMonsterObject(monster, armor, W_ARM);
    assert.equal(findMonsterArmorClass(monster), 30);
    monster.m_lev = 1;
    monster.mhp = 5;
    await equipMonsterObject(monster, amulet, W_AMUL);

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_DEATH));

    assert.equal(game.level.monsters.includes(monster), true);
    assert.equal(monster.mhp, monster.mhpmax);
    assert.equal(monster.minvent.includes(amulet), false);
});

void test('a fire ray burns a web and consumes the closed door behind it', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.u.blindTurns = 10;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const web = addTrap(level, WEB, 11, 10, { tseen: true });
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_FIRE));

    assert.equal(level.traps.includes(web), false);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
});

void test('a fire ray burns floor scrolls and lights an exposed oil lamp', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.u.blindTurns = 10;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const scrolls = await floorObject(SCR_IDENTIFY, 11, 10, {
        quan: 20,
        quantity: 20,
    });
    const lamp = await floorObject(OIL_LAMP, 11, 10, {
        age: 100,
        lamplit: false,
    });
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_FIRE));

    assert.ok(scrolls.where === 'gone' || scrolls.quan < 20);
    assert.equal(lamp.lamplit, true);
});

void test('a cold ray freezes a pool and buries objects under the ice', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const pool = level.requireAt(11, 10);
    pool.typ = POOL;
    const scroll = await floorObject(SCR_IDENTIFY, 11, 10);
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_COLD));

    assert.equal(pool.typ, ICE);
    assert.equal(pool.icedpool, ICED_POOL);
    assert.equal(scroll.where, 'buried');
    assert.ok(level.levelTimers.some(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.x === 11 && timer.y === 10));
});

void test('a fire ray melts ice back into its pool', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const ice = level.requireAt(11, 10);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;
    scheduleLevelTimer(
        11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        (game.moves ?? 0) + 100,
    );
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_FIRE));

    assert.equal(ice.typ, POOL);
    assert.equal(ice.icedpool, 0);
    assert.equal(level.levelTimers.some(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.x === 11 && timer.y === 10), false);
});

void test('melting ice makes the hero crawl out of the pool', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    const acid = await addInventoryObject(POT_ACID);
    game.u.uluck = -5;
    const ice = level.requireAt(game.u.ux, game.u.uy);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;

    await meltIce(game.u.ux, game.u.uy, {
        announce: async () => {},
    });

    assert.equal(ice.typ, POOL);
    assert.notDeepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(IS_POOL(level.requireAt(game.u.ux, game.u.uy).typ), false);
    assert.equal(game.inventory.includes(acid), false);
});

void test('melting ice drowns a land monster but not a swimmer', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.u.blindTurns = 10;
    const ant = await createMonsterAt('giant ant', 11, 10);
    ant.mhp = ant.mhpmax = 4;
    const shark = await createMonsterAt('shark', 12, 10);
    shark.mhp = shark.mhpmax = 20;
    for (const x of [11, 12]) {
        const ice = level.requireAt(x, 10);
        ice.typ = ICE;
        ice.icedpool = ICED_POOL;
    }

    await meltIce(11, 10, { announce: async () => {} });
    await meltIce(12, 10, { announce: async () => {} });

    assert.equal(game.level.monsters.includes(ant), false);
    assert.equal(ant.dead, true);
    assert.equal(game.level.monsters.includes(shark), true);
    assert.equal(shark.mhp, 20);
    assert.ok(!shark.mflee, 'a submerged swimmer does not flee from dryness');
});

void test('a fire ray evaporates a pool into a steaming pit', async () => {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    assert.ok(game.viz_array != null, 'Expected game.viz_array to be initialized');
    assert.ok(game.viz_array[10] != null);
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const pool = level.requireAt(11, 10);
    pool.typ = POOL;
    const door = level.requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    await zapRayWithObject(await knownObject(WAN_FIRE));

    assert.equal(pool.typ, ROOM);
    assert.ok(level.traps.some(trap =>
        trap.ttyp === PIT && trap.tx === 11 && trap.ty === 10));
    assert.ok(level.regions.some(region =>
        region.kind === 'gas-cloud'
        && region.cells.some(cell => cell.x === 11 && cell.y === 10)));
});
