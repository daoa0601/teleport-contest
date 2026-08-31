import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DOOR, D_CLOSED, D_NODOOR, ICE, ICED_POOL, IS_POOL, PIT, POOL, ROOM, WEB,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { meltIce } from '../js/ice.js';
import { pushKey } from '../js/input.js';
import {
    OIL_LAMP, SCR_IDENTIFY, WAN_FIRE, WAN_SLEEP,
} from '../js/object_data.js';
import { place_object } from '../js/mklev.js';
import {
    LEVEL_TIMER_KIND, scheduleLevelTimer,
} from '../js/object_timers.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { zapColdRay, zapDeathRay, zapFireRay } from '../js/zap.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('sleep resistance prevents self-zap helplessness', async () => {
    freshWeaponArena();
    game.urole = { key: 'healer' };
    game.u.sleepResistance = true;
    const wand = {
        otyp: WAN_SLEEP,
        invlet: 'a',
        name: 'sleep',
        oclass: 11,
        quan: 1,
        quantity: 1,
        charges: { current: 3, recharged: 0 },
        spe: 3,
        dknown: true,
        bknown: true,
    };
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

test('a fire ray burns a monster in its path', async () => {
    freshWeaponArena();
    game.u.fireResistance = true;
    game.u.uhp = game.u.uhpmax = 100;
    const monster = {
        mnum: 0,
        m_id: 9001,
        mx: 11,
        my: 10,
        mac: 100,
        m_lev: 1,
        mhp: 100,
        mhpmax: 100,
        msleeping: 1,
        mstrategy: 0x20000000,
        minvent: [],
        inventory: [],
    };
    game.level.monsters = [monster];
    const wand = {
        otyp: WAN_FIRE,
        invlet: 'a',
        name: 'fire',
        oclass: 11,
        quan: 1,
        quantity: 1,
        charges: { current: 3, recharged: 0 },
        spe: 3,
        dknown: true,
        bknown: true,
    };
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
    freshWeaponArena();
    game.blind = true;
    game.u.blindTurns = 10;
    game.u.unblind_telepat_range = -1;
    game.viz_array[10][11] = 0;
    const death = {
        mnum: 311,
        m_id: 9002,
        mx: 11,
        my: 10,
        mac: 100,
        m_lev: 30,
        mhp: 5,
        mhpmax: 20,
        minvent: [],
        inventory: [],
    };
    game.level.monsters = [death];

    await zapDeathRay('l');

    assert.equal(death.mhp, 30);
    assert.equal(death.mhpmax, 30);
    assert.ok(game.level.monsters.includes(death));
});

test('a fire ray burns a web and consumes the closed door behind it', async () => {
    const level = freshWeaponArena();
    game.blind = true;
    game.u.blindTurns = 10;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const web = { ttyp: WEB, tx: 11, ty: 10, tseen: true };
    level.traps.push(web);
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.equal(level.traps.includes(web), false);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
});

test('a fire ray burns floor scrolls and lights an exposed oil lamp', async () => {
    const level = freshWeaponArena();
    game.blind = true;
    game.u.blindTurns = 10;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const scrolls = place_object({
        otyp: SCR_IDENTIFY,
        oclass: 9,
        quan: 20,
        quantity: 20,
        owt: 100,
        artifact: false,
    }, 11, 10);
    const lamp = place_object({
        otyp: OIL_LAMP,
        oclass: 6,
        quan: 1,
        quantity: 1,
        age: 100,
        cursed: false,
        lamplit: false,
    }, 11, 10);
    const door = level.at(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await zapFireRay('l');

    assert.ok(scrolls.where === 'gone' || scrolls.quan < 20);
    assert.equal(lamp.lamplit, true);
});

test('a cold ray freezes a pool and buries objects under the ice', async () => {
    const level = freshWeaponArena();
    game.blind = true;
    game.deaf = true;
    game.u.blindTurns = 10;
    game.u.deaf = true;
    game.viz_array[10][11] = 0;
    game.viz_array[10][12] = 0;
    const pool = level.at(11, 10);
    pool.typ = POOL;
    const scroll = place_object({
        otyp: SCR_IDENTIFY,
        oclass: 9,
        quan: 1,
        quantity: 1,
        artifact: false,
    }, 11, 10);
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
    const level = freshWeaponArena();
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
    const level = freshWeaponArena();
    const ice = level.at(game.u.ux, game.u.uy);
    ice.typ = ICE;
    ice.icedpool = ICED_POOL;

    await meltIce(game.u.ux, game.u.uy, {
        announce: async () => {},
    });

    assert.equal(ice.typ, POOL);
    assert.notDeepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(IS_POOL(level.at(game.u.ux, game.u.uy).typ), false);
});

test('melting ice drowns a land monster but not a swimmer', async () => {
    const level = freshWeaponArena();
    game.blind = true;
    game.u.blindTurns = 10;
    const ant = {
        mnum: MONSTER_NAME.indexOf('giant ant'),
        m_id: 9101,
        mx: 11,
        my: 10,
        mhp: 4,
        mhpmax: 4,
        minvent: [],
        inventory: [],
    };
    const shark = {
        mnum: MONSTER_NAME.indexOf('shark'),
        m_id: 9102,
        mx: 12,
        my: 10,
        mhp: 20,
        mhpmax: 20,
        minvent: [],
        inventory: [],
    };
    game.level.monsters = [ant, shark];
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
    const level = freshWeaponArena();
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
