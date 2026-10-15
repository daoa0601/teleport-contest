import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import {
    DBWALL, DB_EAST, DB_MOAT, DOOR, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED,
    M_AP_OBJECT, M_SEEN_MAGR, MM_NOGRP, MM_NOWAIT, NO_MINVENT, STONE, W_AMUL,
} from '../js/const.js';
import { pline, plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { resolveMonsterImmediateWand } from '../js/monster_wand_ray.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, CORPSE, ROCK, WAN_STRIKING,
    WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { roles } from '../js/roles.js';
import { objectTypeKnown } from '../js/shk.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject, uninitializedObject, untimedCorpse } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { installPolymorphedHero } from './support/hero-state.js';

const MONSTER_FLAGS = NO_MINVENT | MM_NOGRP | MM_NOWAIT;

async function wandRoom(type = WAN_STRIKING, heroX = 18, heroY = 12) {
    freshObjectRoom({ left: 2, right: 25, heroX, heroY, gameplaySeed: 37n });
    requirePlayingGame(game);
    game.context.mon_moving = true;
    game.context.zap_oseen = true;
    const source = await createMonsterAt('orc', 7, 10, MONSTER_FLAGS);
    source.mux = 22;
    source.muy = 10;
    source.mwandexp = true;
    const wand = await uninitializedObject(type, { typeKnown: false, known: false, spe: 1 });
    await addObjectToMonsterInventory(source, wand);
    const messages: string[] = [];
    const options = {
        state: game,
        random: (bound: number) => bound - 1,
        rollOne: () => 1,
        rollDice: () => 8,
        publish: async (message: string) => {
            messages.push(message);
            await plineWithContinuation(message);
        },
    };
    installPagerInput(resetInputState(), {
        expected: /wand|Boing|resist|orc|zombie|boulder|door|corpse|troll|resurrect|alive|reanimat|medallion|amulet|much better|But wait|You die|portcullis|drawbridge|shudder|frightened|stunned|mysterious force|disappears|appears/i,
        limit: 40,
    });
    return { source, wand, options, messages, level: game.level };
}

async function targetAt(x: number, species = 'orc') {
    const target = await createMonsterAt(species, x, 10, MONSTER_FLAGS);
    target.mhp = target.mhpmax = 100;
    return target;
}

void test('a striking ray hits multiple monsters without the hero Knight bonus or first-shot penalty', async () => {
    const { source, wand, options } = await wandRoom();
    source.mwandexp = false;
    const first = await targetAt(10);
    const second = await targetAt(14);
    const knight = roles.find(role => role.key === 'knight');
    assert.ok(knight);
    game.urole = knight;
    options.state.u.uhave.questart = true;

    const result = await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(result.heroDied, false);
    assert.equal(first.mhp, 92);
    assert.equal(second.mhp, 92);
    assert.equal(game.bhitpos.x, 14);
    assert.equal(game.bhitpos.y, 10);
    assert.equal(objectTypeKnown(wand, options.state), true);
});

void test('intervening stone stops a ray before it reaches a later monster', async () => {
    const { source, wand, options, level } = await wandRoom();
    const target = await targetAt(12);
    level.requireAt(10, 10).typ = STONE;
    vision_note_blocker_change(10, 10);
    vision_recalc(0);

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(target.mhp, 100);
    assert.equal(game.bhitpos.x, 9);
    assert.equal(objectTypeKnown(wand, options.state), false);
});

void test('a displaced aim sends the ray toward the remembered square instead of the actual hero', async () => {
    const { source, wand, options } = await wandRoom(WAN_STRIKING, 10, 10);
    source.mux = 11;
    source.muy = 14;
    const target = await createMonsterAt('orc', 9, 12, MONSTER_FLAGS);
    target.mhp = target.mhpmax = 100;

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(game.u.uhp, 40);
    assert.equal(target.mhp, 92);
});

void test('striking wakes and reveals a mimic even when the attack misses', async () => {
    const { source, wand, options, messages } = await wandRoom();
    const mimic = await targetAt(9, 'large mimic');
    mimic.msleeping = 1;
    mimic.m_ap_type = M_AP_OBJECT;
    mimic.mappearance = BOULDER;

    await resolveMonsterImmediateWand(source, wand, { ...options, rollOne: sides => sides });

    assert.equal(mimic.msleeping, 0);
    assert.equal(mimic.m_ap_type, 0);
    assert.equal(mimic.mhp, 100);
    assert.ok(messages.some(message => /wand misses/.test(message)));
});

void test('innate magic resistance blocks striking and identifies a seen wand', async () => {
    const { source, wand, options, messages } = await wandRoom();
    const dragon = await targetAt(9, 'gray dragon');

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(dragon.mhp, 100);
    assert.ok(messages.includes('Boing!'));
    assert.equal(objectTypeKnown(wand, options.state), true);
});

void test('a visible resisted impact does not identify a wand whose use was unseen', async () => {
    const { source, wand, options } = await wandRoom();
    game.context.zap_oseen = false;
    const dragon = await targetAt(9, 'gray dragon');

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(dragon.mhp, 100);
    assert.equal(objectTypeKnown(wand, options.state), false);
});

void test('a monster resistance roll halves striking damage and preserves peacefulness', async () => {
    const { source, wand, options, messages } = await wandRoom();
    const lich = await targetAt(8, 'lich');
    lich.mpeaceful = 1;

    await resolveMonsterImmediateWand(source, wand, { ...options, random: () => 0 });

    assert.equal(lich.mhp, 96);
    assert.equal(lich.mpeaceful, 1);
    assert.ok(messages.some(message => /resists!/.test(message)));
});

void test('an inexperienced caster misses the hero while still interrupting repeated movement', async () => {
    const { source, wand, options, messages } = await wandRoom(WAN_STRIKING, 10, 10);
    source.mwandexp = false;
    game.multi = 4;

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(game.u.uhp, 40);
    assert.equal(game.multi, 0);
    assert.ok(messages.includes('The wand misses you.'));
    assert.equal(objectTypeKnown(wand, options.state), false);
});

void test('an experienced striking caster damages the hero and forgets an obsolete resistance', async () => {
    const { source, wand, options } = await wandRoom(WAN_STRIKING, 10, 10);
    source.seen_resistance = M_SEEN_MAGR;
    grantIntrinsicProperty('halfSpellDamage', 'outside');

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(game.u.uhp, 36);
    assert.equal((source.seen_resistance ?? 0) & M_SEEN_MAGR, 0);
    assert.equal(objectTypeKnown(wand, options.state), true);
});

void test('hero antimagic is observed and disclosed even on an inexperienced caster first shot', async () => {
    const { source, wand, options, messages } = await wandRoom(WAN_STRIKING, 10, 10);
    source.mwandexp = false;
    grantIntrinsicProperty('antimagic', 'outside');

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(game.u.uhp, 40);
    assert.equal((source.seen_resistance ?? 0) & M_SEEN_MAGR, M_SEEN_MAGR);
    assert.ok(messages.includes('Boing!'));
    assert.equal(objectTypeKnown(wand, options.state), true);
});

void test('striking damage waits for the hit-message continuation', async () => {
    const { source, wand, options } = await wandRoom(WAN_STRIKING, 10, 10);
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const ray = resolveMonsterImmediateWand(source, wand, options);
    await input.waitUntilBlocked();
    assert.equal(game.u.uhp, 40);
    input.feed(' ');
    await ray;

    assert.equal(game.u.uhp, 32);
});

void test('hero life saving completes before striking reaches the next monster', async () => {
    const { source, wand, options } = await wandRoom(WAN_STRIKING, 9, 10);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    game.u.uhp = 1;
    const target = await targetAt(11);

    const result = await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(result.heroDied, false);
    assert.equal(amulet.where, 'gone');
    assert.ok(game.u.uhp > 0);
    assert.equal(target.mhp, 92);
});

void test('monster life saving preserves the victim and lets the ray continue', async () => {
    const { source, wand, options } = await wandRoom();
    const first = await targetAt(9);
    first.mhp = 1;
    const amulet = await equipMonsterObject(first, await uninitializedObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    const second = await targetAt(11);

    await resolveMonsterImmediateWand(source, wand, options);

    assert.ok(first.mhp > 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(second.mhp, 92);
});

void test('striking processes both boulders in a pile but shortens the ray only once', async () => {
    const { source, wand, options, level } = await wandRoom();
    await floorObject(BOULDER, 9, 10);
    await floorObject(BOULDER, 9, 10);
    const target = await targetAt(19);

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(target.mhp, 92);
    assert.equal(floorObjectsAt(level, 9, 10).some(object => object.otyp === BOULDER), false);
    assert.ok(floorObjectsAt(level, 9, 10).some(object => object.otyp === ROCK));
});

void test('striking opens a closed door and continues into the room', async () => {
    const { source, wand, options, level } = await wandRoom();
    const door = level.requireAt(9, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    vision_note_blocker_change(9, 10);
    vision_recalc(0);
    const target = await targetAt(12);

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(door.doormask, D_BROKEN);
    assert.equal(target.mhp, 92);
});

void test('a striking ray passes over a raised bridge then destroys its portcullis', async () => {
    const { source, wand, options, level } = await wandRoom();
    const beyondPortcullis = await targetAt(12);
    const bridge = level.requireAt(9, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_EAST | DB_MOAT;
    const wall = level.requireAt(10, 10);
    wall.typ = DBWALL;
    vision_note_blocker_change(10, 10);
    vision_recalc(0);

    const result = await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(result.heroDied, false);
    assert.notEqual(bridge.typ, DRAWBRIDGE_UP);
    assert.notEqual(wall.typ, DBWALL);
    assert.equal(beyondPortcullis.mhp, 100);
});

void test('teleportation relocates a monster and every floor object at its old square', async () => {
    const { source, wand, options, level } = await wandRoom(WAN_TELEPORTATION);
    const target = await targetAt(9);
    const rock = await floorObject(ROCK, 9, 10);
    target.msleeping = 1;

    await resolveMonsterImmediateWand(source, wand, { state: options.state });

    assert.ok(target.mx !== 9 || target.my !== 10);
    assert.equal(target.msleeping, 0);
    assert.equal(rock.where, 'floor');
    assert.equal(floorObjectsAt(level, 9, 10).includes(rock), false);
    assert.equal(objectTypeKnown(wand, options.state), false);
});

void test('restricted monster teleportation wakes its target without relocating it', async () => {
    const { source, wand, options, level } = await wandRoom(WAN_TELEPORTATION);
    const target = await targetAt(9);
    target.msleeping = 1;
    level.flags.noteleport = true;

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(target.mx, 9);
    assert.equal(target.my, 10);
    assert.equal(target.msleeping, 0);
});

void test('undead turning revives floor corpses and a living monster carried corpse', async () => {
    const { source, wand, options } = await wandRoom(WAN_UNDEAD_TURNING);
    const floorCorpse = placeCreatedObject(await untimedCorpse(MONSTER_NAME.indexOf('troll')), 8, 10);
    const carrier = await targetAt(10);
    const carriedCorpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'));
    await addObjectToMonsterInventory(carrier, carriedCorpse);
    carrier.msleeping = 1;

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(floorCorpse.where, 'gone');
    assert.equal(carriedCorpse.where, 'gone');
    assert.equal(carrier.msleeping, 0);
    assert.equal(carrier.mhp, 100);
    assert.equal(objectTypeKnown(wand, options.state), true);
});

void test('undead turning leaves an unaffected living sleeper asleep', async () => {
    const { source, wand, options } = await wandRoom(WAN_UNDEAD_TURNING);
    const target = await targetAt(9);
    target.msleeping = 1;

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(target.msleeping, 1);
    assert.equal(target.mhp, 100);
    assert.equal(objectTypeKnown(wand, options.state), false);
});

void test('monster-cast undead turning damages and wakes undead without making them flee', async () => {
    const { source, wand, options } = await wandRoom(WAN_UNDEAD_TURNING);
    const zombie = await targetAt(9, 'giant zombie');
    zombie.msleeping = 1;

    await resolveMonsterImmediateWand(source, wand, { ...options, rollOne: sides => sides });

    assert.equal(zombie.mhp, 92);
    assert.equal(zombie.msleeping, 0);
    assert.equal(!!zombie.mflee, false);
});

void test('a corpse created by undead turning is not revived by the same ray', async () => {
    const { source, wand, options, level } = await wandRoom(WAN_UNDEAD_TURNING);
    const zombie = await targetAt(9, 'giant zombie');
    zombie.mhp = 1;

    await resolveMonsterImmediateWand(source, wand, { ...options, rollOne: sides => sides });

    assert.equal(zombie.dead, true);
    const corpse = floorObjectsAt(level, 9, 10).find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'the giant zombie should leave its corpse on the floor');
    assert.equal(corpse.bypass, true);
    assert.equal(level.monsters.some(monster => !monster.dead && monster.mx === 9 && monster.my === 10), false);
});

void test('undead turning stuns the actual undead hero form and revives carried corpses', async () => {
    const { source, wand, options } = await wandRoom(WAN_UNDEAD_TURNING, 10, 10);
    installPolymorphedHero('human zombie', { hitPoints: 40 });
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'));
    corpse.where = 'inventory';
    game.inventory.push(corpse);

    await resolveMonsterImmediateWand(source, wand, options);

    assert.equal(corpse.where, 'gone');
    assert.ok((game.u.stunnedTurns ?? 0) > 0);
    assert.equal(game.u.mh, 40);
    assert.equal(objectTypeKnown(wand, options.state), true);
});
