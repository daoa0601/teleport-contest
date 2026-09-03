import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COULD_SEE, DOOR, D_CLOSED, D_NODOOR, ICE, ICED_POOL, IS_POOL, PIT,
    POOL, ROOM, SDOOR, W_AMUL, WEB,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { meltIce } from '../js/ice.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, APPLE, OIL_LAMP, POT_ACID, SCR_IDENTIFY,
    WAN_CREATE_MONSTER,
    WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_SECRET_DOOR_DETECTION,
    WAN_SLEEP, WAN_STASIS, WAN_WISHING,
} from '../js/object_data.js';
import {
    LEVEL_TIMER_KIND, scheduleLevelTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { heroTeleportRestricted } from '../js/teleport_rules.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import {
    zapCancellationRay, zapColdRay, zapDeathRay, zapFireRay,
} from '../js/zap.js';
import {
    addInventoryObject, chargedWand, floorObject,
} from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

function highestRoll(range) {
    return range - 1;
}

test('sleep resistance prevents self-zap helplessness', async () => {
    freshGameplayRoom();
    game.urole = { key: 'healer' };
    game.u.sleepResistance = true;
    const wand = chargedWand(WAN_SLEEP);
    game.inventory = [wand];
    pushKey('a');
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(wand.charges.current, 2);
    assert.equal(wand.typeKnown, true);
    assert.equal(game._helplessTurns, undefined);
    assert.equal(game._pending_message, "You don't feel sleepy!");
    assert.equal(game.context.move, 1);
});

test('cancellation restores a werewolf to human form', async () => {
    freshGameplayRoom();
    const werewolf = addMonster({
        species: 'werewolf', x: 11, y: 10,
    });

    await zapCancellationRay('l', { random: highestRoll });

    assert.equal(werewolf.mnum, 263);
    assert.equal(werewolf.mcan, 1);
});

test('cancellation destroys a clay golem', async () => {
    freshGameplayRoom();
    const golem = addMonster({
        species: 'clay golem', x: 11, y: 10,
    });
    pushKeys(' '.repeat(20));

    await zapCancellationRay('l', { random: highestRoll });

    assert.equal(golem.dead, true);
    assert.equal(game.level.monsters.includes(golem), false);
});

test('an empty wand does nothing without asking for a direction', async () => {
    freshGameplayRoom();
    const wand = chargedWand(WAN_SLEEP, { charges: 0 });
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), true);
    assert.equal(wand.spe, 0);
    assert.equal(wand.charges.current, 0);
    assert.equal(game._pending_message, 'Nothing happens.');
    assert.equal(game.context.move, 1);
});

test('a wrested final charge consumes the wand', async () => {
    freshGameplayRoom();
    initRng(49n);
    game.u.sleepResistance = true;
    const wand = chargedWand(WAN_SLEEP, { charges: 0 });
    game.inventory = [wand];
    pushKey('a');
    pushKey('.');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), false);
    assert.equal(wand.where, 'gone');
    assert.equal(game.context.move, 1);
});

test('a cursed wand can explode before asking for a direction', async () => {
    freshGameplayRoom();
    initRng(167n);
    game.u.uhp = game.u.uhpmax = 100;
    const wand = chargedWand(WAN_SLEEP, { cursed: true });
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(game.inventory.includes(wand), false);
    assert.ok(game.u.uhp < 100);
    assert.equal(game.context.move, 1);
});

test('secret door detection reveals nearby hidden terrain and traps', async () => {
    const level = freshGameplayRoom();
    const hiddenDoor = level.at(12, 10);
    hiddenDoor.typ = SDOOR;
    hiddenDoor.doormask = 0;
    const hiddenTrap = addTrap(level, WEB, 11, 11, { tseen: false });
    game.viz_array[10][12] |= COULD_SEE;
    game.viz_array[11][11] |= COULD_SEE;
    const wand = chargedWand(WAN_SECRET_DOOR_DETECTION);
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(hiddenDoor.typ, DOOR);
    assert.equal(hiddenDoor.doormask, D_CLOSED);
    assert.equal(hiddenTrap.tseen, true);
    assert.equal(wand.typeKnown, true);
});

test('light illuminates the visible area and burns a nearby gremlin',
    async () => {
        const level = freshGameplayRoom();
        for (let x = 8; x <= 18; x++) {
            for (let y = 8; y <= 12; y++) level.at(x, y).lit = false;
        }
        vision_reset_new_level();
        vision_recalc(0);
        const gremlin = addMonster({
            species: 'gremlin', x: 11, y: 10, hitPoints: 20,
        });
        const wand = chargedWand(WAN_LIGHT);
        game.inventory = [wand];
        pushKey('a');

        await rhack('z'.charCodeAt(0));

        assert.equal(level.at(11, 10).lit, true);
        assert.equal(level.at(18, 10).lit, false);
        assert.ok(gremlin.mhp < 20);
    });

test('stasis blocks teleporting until its turns expire', async () => {
    freshGameplayRoom();
    game.moves = 100;
    const wand = chargedWand(WAN_STASIS);
    game.inventory = [wand];
    pushKey('a');

    await rhack('z'.charCodeAt(0));

    assert.equal(heroTeleportRestricted(), true);
    game.moves = game.level.flags.stasis_until + 1;
    assert.equal(heroTeleportRestricted(), false);
});

test('create monster summons beside the hero without asking for a direction',
    async () => {
        freshGameplayRoom();
        const wand = chargedWand(WAN_CREATE_MONSTER);
        game.inventory = [wand];
        pushKey('a');

        await rhack('z'.charCodeAt(0));

        assert.ok(game.level.monsters.length > 0);
    });

test('wishing creates the requested object without asking for a direction',
    async () => {
        freshGameplayRoom();
        game.u.uluck = 10;
        const wand = chargedWand(WAN_WISHING);
        game.inventory = [wand];
        pushKey('a');
        pushKey(' ');
        pushKeys('apple\n');

        await rhack('z'.charCodeAt(0));

        assert.ok(game.inventory.some(object => object.otyp === APPLE));
    });

test('enlightenment describes the hero without asking for a direction',
    async () => {
        freshGameplayRoom();
        const wand = chargedWand(WAN_ENLIGHTENMENT);
        game.inventory = [wand];
        pushKey('a');
        pushKey(' ');

        await rhack('z'.charCodeAt(0));

        assert.equal(game._pending_message, 'The feeling subsides.');
    });

test('a fire ray burns a monster in its path', async () => {
    freshGameplayRoom();
    game.u.fireResistance = true;
    game.u.uhp = game.u.uhpmax = 100;
    const monster = addMonster({
        mnum: 0,
        m_id: 9001,
        x: 11,
        y: 10,
        mac: 100,
        level: 1,
        hitPoints: 100,
        msleeping: 1,
        mstrategy: 0x20000000,
    });
    const wand = chargedWand(WAN_FIRE);
    game.inventory = [wand];
    pushKey('a');
    pushKey('l');
    for (let count = 0; count < 30; count++) pushKey(' ');

    await rhack('z'.charCodeAt(0));

    assert.ok(monster.mhp < 100);
    assert.equal(monster.msleeping, 0);
    assert.equal(wand.typeKnown, true);
    assert.equal(game.context.move, 1);
});

test('a death ray makes Death stronger instead of killing him', async () => {
    freshGameplayRoom();
    game.blind = true;
    game.u.blindTurns = 10;
    game.u.unblind_telepat_range = -1;
    game.viz_array[10][11] = 0;
    const death = addMonster({
        mnum: 311,
        m_id: 9002,
        x: 11,
        y: 10,
        mac: 100,
        level: 30,
        hitPoints: 5,
        mhpmax: 20,
    });

    await zapDeathRay('l');

    assert.equal(death.mhp, 30);
    assert.equal(death.mhpmax, 30);
    assert.ok(game.level.monsters.includes(death));
});

test('a worn life-saving amulet saves a monster from a death ray', async () => {
    freshGameplayRoom();
    const amulet = {
        otyp: AMULET_OF_LIFE_SAVING,
        owornmask: W_AMUL,
        worn: true,
        where: 'minvent',
    };
    const monster = addMonster({
        mnum: 0,
        m_id: 9003,
        x: 11,
        y: 10,
        mac: 100,
        level: 1,
        hitPoints: 5,
        inventory: [amulet],
        misc_worn_check: W_AMUL,
    });
    pushKeys(' '.repeat(20));

    await zapDeathRay('l', { finishMonsterKill: finishHeroMonsterKill });

    assert.equal(game.level.monsters.includes(monster), true);
    assert.equal(monster.mhp, monster.mhpmax);
    assert.equal(monster.minvent.includes(amulet), false);
});

test('a fire ray burns a web and consumes the closed door behind it', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.u.blindTurns = 10;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const web = addTrap(level, WEB, 11, 10, { tseen: true });
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.equal(level.traps.includes(web), false);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
});

test('a fire ray burns floor scrolls and lights an exposed oil lamp', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.u.blindTurns = 10;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const scrolls = floorObject(SCR_IDENTIFY, 11, 10, {
        quan: 20,
        quantity: 20,
    });
    const lamp = floorObject(OIL_LAMP, 11, 10, {
        age: 100,
        lamplit: false,
    });
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.ok(scrolls.where === 'gone' || scrolls.quan < 20);
    assert.equal(lamp.lamplit, true);
});

test('a cold ray freezes a pool and buries objects under the ice', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const pool = level.at(11, 10);
    pool.typ = POOL;
    const scroll = floorObject(SCR_IDENTIFY, 11, 10);
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapColdRay('l');

    assert.equal(pool.typ, ICE);
    assert.equal(pool.icedpool, ICED_POOL);
    assert.equal(scroll.where, 'buried');
    assert.ok(level.levelTimers.some(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.x === 11 && timer.y === 10));
});

test('a fire ray melts ice back into its pool', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const ice = level.at(11, 10);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;
    scheduleLevelTimer(
        11, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        (game.moves ?? 0) + 100,
    );
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.equal(ice.typ, POOL);
    assert.equal(ice.icedpool, 0);
    assert.equal(level.levelTimers.some(timer =>
        timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.x === 11 && timer.y === 10), false);
});

test('melting ice makes the hero crawl out of the pool', async () => {
    const level = freshGameplayRoom();
    const acid = addInventoryObject(POT_ACID);
    game.u.uluck = -5;
    const ice = level.at(game.u.ux, game.u.uy);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;

    await meltIce(game.u.ux, game.u.uy, {
        announce: async () => {},
    });

    assert.equal(ice.typ, POOL);
    assert.notDeepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(IS_POOL(level.at(game.u.ux, game.u.uy).typ), false);
    assert.equal(game.inventory.includes(acid), false);
});

test('melting ice drowns a land monster but not a swimmer', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.u.blindTurns = 10;
    const ant = addMonster({
        species: 'giant ant',
        m_id: 9101,
        x: 11,
        y: 10,
        hitPoints: 4,
    });
    const shark = addMonster({
        species: 'shark',
        m_id: 9102,
        x: 12,
        y: 10,
        hitPoints: 20,
    });
    for (const x of [11, 12]) {
        const ice = level.at(x, 10);
        ice.typ = ICE;
        ice.icedpool = ICED_POOL;
    }

    await meltIce(11, 10, { announce: async () => {} });
    await meltIce(12, 10, { announce: async () => {} });

    assert.equal(game.level.monsters.includes(ant), false);
    assert.equal(ant.dead, true);
    assert.equal(game.level.monsters.includes(shark), true);
    assert.equal(shark.mhp, 20);
});

test('a fire ray evaporates a pool into a steaming pit', async () => {
    const level = freshGameplayRoom();
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const pool = level.at(11, 10);
    pool.typ = POOL;
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.equal(pool.typ, ROOM);
    assert.ok(level.traps.some(trap =>
        trap.ttyp === PIT && trap.tx === 11 && trap.ty === 10));
    assert.ok(level.regions.some(region =>
        region.kind === 'gas-cloud'
        && region.cells.some(cell => cell.x === 11 && cell.y === 10)));
});
