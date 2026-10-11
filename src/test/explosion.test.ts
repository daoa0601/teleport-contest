import { installPagerInput } from './support/pager-input.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    D_BROKEN, D_CLOSED, D_NODOOR, DOOR, EXPL_FIERY, EXPL_FROSTY,
    EXPL_MAGICAL, EXPL_NOXIOUS, MM_ANGRY, MM_NOGRP, MON_EXPLODE,
    IRONBARS, NO_MINVENT, PHYS_EXPL_TYPE, W_AMUL,
} from '../js/const.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { explode } from '../js/explosion.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { beginHeroEngulf } from '../js/hero_engulf.js';
import { resetInputState } from '../js/input.js';
import { AT_ENGL, AD_DGST } from '../js/monster_attack_types.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { placeMonsterAt } from '../js/monster_location.js';
import {
    AMULET_OF_LIFE_SAVING, POT_HEALING, SCR_BLANK_PAPER, WAN_DEATH,
    WAN_FIRE, WAN_LIGHT, WAN_MAGIC_MISSILE, WAN_SLEEP, WAN_STRIKING,
} from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

const WAND_CLASS = 11;
const SCROLL_CLASS = 9;

function blastRoom(options = {}) {
    freshObjectRoom({ left: 5, right: 21, hero: { uhp: 500, uhpmax: 500 },
        flags: { verbose: true }, gameplaySeed: 7n, ...options });
    requireFixtureGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    let reads = 0;
    installPagerInput(input, { expected: /explod|explosion|blast|caught in|burn|fire|cold|frost|shock|electric|shatter|destroy|thaw|melt|boil|door|shop|damage|amulet|looks much better|killed|dead|resist|Welcome to experience level|swallow|turn into|Boom|puff of smoke|will cost you|You kill|But wait|medallion/i, limit: 120 });
    input.beforeRead = () => {
        if (++reads > 120) throw new Error(`Unexpected explosion input: ${game._pending_message}`);
        if (game._pending_message) messages.push(game._pending_message);

    };
    return messages;
}

async function bystander(species: string, x: number, y: number, hitPoints = 500) {
    const monster = await createMonsterAt(species, x, y, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = hitPoints;
    return monster;
}

for (const [role, selfDamage] of [
    ['priest', 5], ['monk', 5], ['wizard', 5],
    ['healer', 12], ['knight', 12], ['barbarian', 25],
] as const) {
    void test(`${role} reduces only their own broken-wand damage according to their role`, async () => {
        blastRoom({ role });
        requireFixtureGame(game);
        const jackal = await bystander('jackal', 11, 10);

        await explode(10, 10, -WAN_MAGIC_MISSILE, 25, WAND_CLASS, EXPL_MAGICAL);

        assert.equal(game.u.uhp, 500 - selfDamage);
        assert.equal(jackal.mhp, 475);
    });
}

for (const wand of [WAN_LIGHT, WAN_SLEEP] as const) {
    void test(`${wand === WAN_LIGHT ? 'light' : 'sleep'} wand breakage produces a magical blast resisted by antimagic`, async () => {
        blastRoom();
        requireFixtureGame(game);
        grantIntrinsicProperty('antimagic', 'outside');
        const jackal = await bystander('jackal', 11, 10);
        const angel = await bystander('Angel', 9, 10);

        await explode(10, 10, -wand, 20, WAND_CLASS, EXPL_MAGICAL);

        assert.equal(game.u.uhp, 500);
        assert.equal(jackal.mhp, 480);
        assert.equal(angel.mhp, 500);
        assert.equal(jackal.msleeping, 0);
    });
}

void test('a death wand field spares nonliving creatures but ignores ordinary disintegration resistance', async () => {
    blastRoom();
    requireFixtureGame(game);
    grantIntrinsicProperty('disintegrationResistance', 'outside');
    const golem = await bystander('stone golem', 9, 10);
    const jackal = await bystander('jackal', 11, 10);
    const door = game.level.requireAt(10, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await explode(10, 10, -WAN_DEATH, 20, WAND_CLASS, EXPL_MAGICAL);

    assert.equal(game.u.uhp, 480);
    assert.equal(golem.mhp, 500);
    assert.equal(jackal.mhp, 480);
    assert.equal(game.level.requireAt(10, 9).doormask, D_CLOSED);
});

void test('disintegration protects the hero from breath explosions and destroys adjacent doors', async () => {
    blastRoom();
    requireFixtureGame(game);
    grantIntrinsicProperty('disintegrationResistance', 'outside');
    const door = game.level.requireAt(10, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;

    await explode(10, 10, 24, 20, 0, EXPL_MAGICAL);

    assert.equal(game.u.uhp, 500);
    assert.equal(game.level.requireAt(10, 9).doormask, D_NODOOR);
});

void test('a striking wand blast breaks doors while a miscellaneous wand leaves them intact', async () => {
    const messages = blastRoom();
    requireFixtureGame(game);
    const door = game.level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await explode(10, 10, -WAN_LIGHT, 10, WAND_CLASS, EXPL_MAGICAL);
    assert.equal(door.doormask, D_CLOSED);

    await explode(10, 10, -WAN_STRIKING, 10, WAND_CLASS, EXPL_MAGICAL);
    await flushPendingTopline();

    assert.equal(door.doormask, D_BROKEN);
    assert.match(messages.join(' '), /door remains intact.*door crashes open/s);
});

for (const [type, style] of [[PHYS_EXPL_TYPE, EXPL_NOXIOUS], [27, EXPL_NOXIOUS]] as const) {
    void test(`${type === PHYS_EXPL_TYPE ? 'physical' : 'acid'} blast damage is halved only for the hero`, async () => {
        blastRoom();
        requireFixtureGame(game);
        grantIntrinsicProperty('halfPhysicalDamage', 'outside');
        const jackal = await bystander('jackal', 11, 10);

        await explode(10, 10, type, 15, 0, style);

        assert.equal(game.u.uhp, 492);
        assert.equal(jackal.mhp, 485);
    });
}

void test('a fire blast from inside an engulfer cannot burn the floor or a bystander', async () => {
    blastRoom();
    requireFixtureGame(game);
    const swallower = await bystander('purple worm', 11, 10);
    const outside = await bystander('jackal', 9, 10);
    const sleeper = await bystander('kobold', 16, 10);
    sleeper.msleeping = 1;
    const paper = await floorObject(SCR_BLANK_PAPER, 10, 10, { quantity: 20 });
    const oldX = swallower.mx, oldY = swallower.my;
    placeMonsterAt(swallower, 10, 10);
    game.u.ustuck = swallower;
    await beginHeroEngulf(swallower, { kind: 'hero-attack', attackType: AT_ENGL, hit: true, damageType: AD_DGST, engulfOldX: oldX, engulfOldY: oldY });

    await explode(10, 10, -WAN_FIRE, 10, WAND_CLASS, EXPL_FIERY);

    assert.ok(swallower.mhp < 500);
    assert.equal(game.u.uhp, 490);
    assert.equal(outside.mhp, 500);
    assert.equal(paper.quan, 20);
    assert.equal(sleeper.msleeping, 1);
});

void test('a hero holding a victim takes double blast damage even when the victim dies first', async () => {
    blastRoom();
    requireFixtureGame(game);
    await polymonHero(MONSTER_NAME.indexOf('large mimic'));
    game.u.mh = game.u.mhmax = 500;
    const victim = await bystander('jackal', 11, 10, 1);
    game.u.ustuck = victim;

    await explode(10, 10, -WAN_MAGIC_MISSILE, 20, WAND_CLASS, EXPL_MAGICAL);

    assert.ok(!game.level.monsters.includes(victim));
    assert.equal(game.u.mh, 460);
});

void test('a zero-damage explosion wakes nearby sleepers without altering its floor or inventory', async () => {
    blastRoom();
    requireFixtureGame(game);
    const sleeper = await bystander('jackal', 15, 10);
    sleeper.msleeping = 1;
    const paper = await floorObject(SCR_BLANK_PAPER, 10, 10, { quantity: 20 });
    const potions = await addInventoryObject(POT_HEALING, { quantity: 20 });

    await explode(10, 10, -WAN_FIRE, 0, WAND_CLASS, EXPL_FIERY);

    assert.equal(sleeper.msleeping, 0);
    assert.equal(game.u.uhp, 500);
    assert.equal(paper.quan, 20);
    assert.equal(potions.quan, 20);
});

void test('a hero polymorph explosion spares their body and carried gear', async () => {
    blastRoom();
    requireFixtureGame(game);
    const potions = await addInventoryObject(POT_HEALING, { quantity: 30 });
    const jackal = await bystander('jackal', 11, 10);

    await explode(10, 10, 2, 30, MON_EXPLODE, EXPL_FROSTY);

    assert.equal(game.u.uhp, 500);
    assert.equal(potions.quan, 30);
    assert.equal(jackal.mhp, 470);
});

void test('a scroll fire blast burns property without repeating the hero caught message', async () => {
    const messages = blastRoom();
    requireFixtureGame(game);
    await floorObject(SCR_BLANK_PAPER, 10, 10, { quantity: 30 });

    await explode(10, 10, 11, 20, SCROLL_CLASS, EXPL_FIERY);
    await flushPendingTopline();

    assert.equal(game.u.uhp, 480);
    assert.doesNotMatch(messages.join(' '), /You are caught/);
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).reduce((sum, obj) => sum + obj.quan, 0) < 30);
});

void test('monster life saving completes before a wand blast reaches the hero', async () => {
    blastRoom();
    requireFixtureGame(game);
    const jackal = await bystander('jackal', 9, 10, 1);
    const amulet = await equipMonsterObject(jackal, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);

    await explode(10, 10, -WAN_MAGIC_MISSILE, 20, WAND_CLASS, EXPL_MAGICAL);

    assert.ok(game.level.monsters.includes(jackal));
    assert.ok(jackal.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(game.u.uhp, 480);
});

void test('a broken fire wand charges shop structural damage and burned floor stock', async () => {
    blastRoom();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, keeperY: 10, doorX: 10, doorY: 9 });
    const door = game.level.requireAt(10, 9);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await floorObject(SCR_BLANK_PAPER, 10, 10, { quantity: 30 });
    initRng(7n);

    await explode(10, 10, -WAN_FIRE, 10, WAND_CLASS, EXPL_FIERY);

    assert.equal(game.level.requireAt(10, 9).doormask, D_NODOOR);
    assert.ok(game.level.damagelist !== null && game.level.damagelist !== undefined);
    assert.ok(game.level.damagelist.some(record => record.cost === 400));
    assert.ok(shopkeeper.eshk.bill.some(entry => entry.useup));
    assert.equal(shopkeeper.mpeaceful, 0);
});


void test('poison explosions leave poisonous gas in every open blast square', async () => {
    blastRoom();
    requireFixtureGame(game);
    grantIntrinsicProperty('poisonResistance', 'outside');

    await explode(10, 10, 26, 20, 0, EXPL_NOXIOUS);

    assert.equal(game.u.uhp, 500);
    const clouds = game.level.regions.filter(region => region.damage === 8);
    assert.ok(clouds.some(region => region.cells.some(cell => cell.x === 9 && cell.y === 9)));
    assert.ok(clouds.some(region => region.cells.some(cell => cell.x === 11 && cell.y === 11)));
});

void test('acid blasts dissolve bars at a room edge into an open doorway', async () => {
    blastRoom();
    requireFixtureGame(game);
    const bars = game.level.requireAt(11, 10);
    bars.typ = IRONBARS;
    bars.edge = true;

    await explode(10, 10, 27, 20, 0, EXPL_NOXIOUS);

    assert.equal(bars.typ, DOOR);
    assert.equal(bars.doormask, D_NODOOR);
});

void test('the explosion waits for unread prose before damaging a nearby monster', async () => {
    freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 }, flags: { verbose: true } });
    requireFixtureGame(game);
    const jackal = await bystander('jackal', 9, 10);
    const input = resetInputState();
    await plineWithContinuation('The chamber trembles as the power in your wand builds around you.');
    const pending = explode(10, 10, -WAN_MAGIC_MISSILE, 20, WAND_CLASS, EXPL_MAGICAL);
    await input.waitUntilBlocked();

    try {
        assert.equal(jackal.mhp, 500);
        assert.equal(game.u.uhp, 500);
    } finally {
        input.feed(' '.repeat(30));
        await pending;
    }
    assert.equal(jackal.mhp, 480);
    assert.equal(game.u.uhp, 480);
});


void test('a monster burning itself to cure slime credits the hero without breaking pacifism', async () => {
    blastRoom({ context: { mon_moving: true } });
    requireFixtureGame(game);
    const paper = await bystander('paper golem', 14, 10, 1);
    const jackal = await bystander('jackal', 13, 10, 1);
    const experience = game.u.uexp || 0;

    await explode(14, 10, -11, 30, SCROLL_CLASS, -EXPL_FIERY);

    assert.ok(!game.level.monsters.includes(paper));
    assert.ok(!game.level.monsters.includes(jackal));
    assert.ok(game.u.uexp > experience);
    assert.equal(game.u.uconduct.killer || 0, 0);
    assert.ok(!(floorObjectsAt(requireGameLevel(game), 14, 10) || []).some(object => object.otyp === SCR_BLANK_PAPER));
});
