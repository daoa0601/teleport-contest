import type { PickLockOccupation } from '../js/occupation_types.js';
import { installPagerInput } from './support/pager-input.js';
import { createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { changeDoorByMagic } from '../js/door_magic.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { requireGameDisplay, requireGameLevel, game } from '../js/gstate.js';
import {
    DOOR, SDOOR, STONE, D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED,
    D_TRAPPED, NO_MINVENT, PIT, TRAPPED_DOOR, W_AMUL,
    M_AP_FURNITURE, M_AP_OBJECT, M_AP_F_DKNOWN,
} from '../js/const.js';
import {
    AMULET_OF_LIFE_SAVING, LOCK_PICK, ROCK, SPE_FORCE_BOLT, SPE_KNOCK, SPE_WIZARD_LOCK,
    WAN_LOCKING, WAN_OPENING, WAN_STRIKING,
} from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { runMonsterAction } from '../js/monmove.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { cansee, vision_reset, vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';

function screen() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
function freshDoor(options = {}) {
    freshObjectRoom({ left: 2, right: 30, flags: { verbose: true }, ...options });
    requireFixtureGame(game);
    delete game.rogue_level;
    const input = resetInputState();
    installPagerInput(input, { expected: /door|trap|crash|shatter|click|shop|damage|pay|earlier announcement|medallion|looks much better|But wait/i, limit: 30 });
    return input;
}
function doorAt(x: number, y: number, mask: number, type = DOOR) {
    const door = requireGameLevel(game).requireAt(x, y);
    door.typ = type;
    door.doormask = mask;
    vision_reset();
    vision_recalc(0);
    return door;
}

for (const type of [WAN_OPENING, SPE_KNOCK] as const) {
    void test(`${type === WAN_OPENING ? 'opening wand' : 'knock spell'} unlocks an ordinary door while preserving its trap`, async () => {
        freshDoor();
        const source = await knownObject(type);
        const door = doorAt(11, 10, D_LOCKED | D_TRAPPED);
        assert.equal(await changeDoorByMagic(source, 11, 10), true);
        assert.equal(door.doormask, D_CLOSED | D_TRAPPED);
        assert.equal(await changeDoorByMagic(source, 11, 10), false);
    });
    void test(`${type === WAN_OPENING ? 'opening wand' : 'knock spell'} reveals a secret door without opening or detonating it`, async () => {
        freshDoor();
        const source = await knownObject(type);
        const door = doorAt(11, 10, D_LOCKED | D_TRAPPED, SDOOR);
        await changeDoorByMagic(source, 11, 10);
        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_CLOSED | D_TRAPPED);
    });
}

for (const [mask, label] of [[D_NODOOR, 'doorway'], [D_BROKEN, 'broken door'], [D_ISOPEN, 'open door'], [D_CLOSED, 'closed door']] as const) {
    void test(`locking magic constructs or repairs and locks a ${label}`, async () => {
        freshDoor();
        const source = await knownObject(SPE_WIZARD_LOCK);
        const door = doorAt(11, 10, mask | D_TRAPPED);
        assert.equal(await changeDoorByMagic(source, 11, 10), true);
        assert.equal(door.doormask, D_LOCKED | D_TRAPPED);
        assert.equal(await changeDoorByMagic(source, 11, 10), false);
    });
}

void test('locking a secret door does not reveal or alter it', async () => {
    freshDoor();
    const source = await knownObject(WAN_LOCKING);
    const door = doorAt(11, 10, D_NODOOR, SDOOR);
    assert.equal(await changeDoorByMagic(source, 11, 10), false);
    assert.equal(door.typ, SDOOR);
    assert.equal(door.doormask, D_NODOOR);
});

void test('locking magic cannot assemble a door over a floor trap', async () => {
    freshDoor();
    requireFixtureGame(game);
    const source = await knownObject(SPE_WIZARD_LOCK);
    const door = doorAt(11, 10, D_NODOOR);
    game.level.traps.push({ tx: 11, ty: 10, ttyp: PIT, tseen: false, once: false, launch: { x: 0, y: 0 } });
    assert.equal(await changeDoorByMagic(source, 11, 10), false);
    assert.equal(door.doormask, D_NODOOR);
    await flush_screen();
    assert.ok(screen().includes('quickly dissipates'));
});

for (const observed of [false, true] as const) {
    void test(`a ${observed ? 'seen' : 'unseen'} locking wand respects floor obstruction ${observed ? 'with feedback' : 'silently'}`, async () => {
        freshDoor();
        const source = await knownObject(WAN_LOCKING, { dknown: observed });
        const door = doorAt(11, 10, D_ISOPEN);
        await floorObject(ROCK, 11, 10);
        assert.equal(await changeDoorByMagic(source, 11, 10), false);
        assert.equal(door.doormask, D_ISOPEN);
        await flush_screen();
        assert.equal(screen().includes("Something's in the way."), observed);
    });
}

void test('an unseen monster obstructing a lock is marked without revealing its identity', async () => {
    freshDoor();
    requireFixtureGame(game);
    const monster = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    monster.minvis = true;
    const source = await knownObject(WAN_LOCKING, { dknown: false });
    doorAt(11, 10, D_ISOPEN);
    assert.equal(await changeDoorByMagic(source, 11, 10), false);
    assert.equal(game.level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    await flush_screen();
    assert.ok(!screen().includes('orc blocks'));
});

for (const appearance of [M_AP_OBJECT, M_AP_FURNITURE] as const) {
    void test(`a known ${appearance === M_AP_OBJECT ? 'object' : 'furniture'} disguise keeps native locking obstruction rules`, async () => {
        freshDoor();
        const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
        mimic.m_ap_type = appearance | M_AP_F_DKNOWN;
        mimic.mappearance = appearance === M_AP_OBJECT ? ROCK : CmapSymbol.fountain;
        const source = await knownObject(SPE_WIZARD_LOCK);
        const door = doorAt(11, 10, D_ISOPEN);
        assert.equal(await changeDoorByMagic(source, 11, 10), appearance === M_AP_FURNITURE);
        assert.equal(door.doormask, appearance === M_AP_FURNITURE ? D_LOCKED : D_ISOPEN);
        assert.equal(mimic.m_ap_type, appearance | M_AP_F_DKNOWN);
    });
}

void test('Rogue locking hides an unobstructed doorway even when there is a floor trap', async () => {
    freshDoor();
    requireFixtureGame(game);
    game.rogue_level = createSpecialLevel({ ...game.u.uz });
    const source = await knownObject(WAN_LOCKING);
    const door = doorAt(11, 10, D_NODOOR);
    game.level.traps.push({ tx: 11, ty: 10, ttyp: PIT, tseen: false, once: false, launch: { x: 0, y: 0 } });
    assert.equal(await changeDoorByMagic(source, 11, 10), true);
    assert.equal(door.typ, SDOOR);
    assert.equal(door.doormask, D_NODOOR);
});

void test('an obstructed Rogue doorway keeps its original terrain after the dust cloud dissipates', async () => {
    freshDoor();
    requireFixtureGame(game);
    game.rogue_level = createSpecialLevel({ ...game.u.uz });
    const source = await knownObject(SPE_WIZARD_LOCK);
    const door = doorAt(11, 10, D_NODOOR);
    await floorObject(ROCK, 11, 10);
    assert.equal(await changeDoorByMagic(source, 11, 10), false);
    assert.equal(door.typ, DOOR);
    assert.equal(door.doormask, D_NODOOR);
});

for (const type of [WAN_STRIKING, SPE_FORCE_BOLT] as const) {
    void test(`${type === WAN_STRIKING ? 'striking wand' : 'force-bolt spell'} breaks an untrapped closed door and exposes the room beyond`, async () => {
        freshDoor();
        requireFixtureGame(game);
        for (let y = 6; y <= 14; y++) game.level.requireAt(11, y).typ = STONE;
        const source = await knownObject(type);
        const door = doorAt(11, 10, D_CLOSED);
        assert.equal(cansee(13, 10), false);
        assert.equal(await changeDoorByMagic(source, 11, 10), true);
        assert.equal(door.doormask, D_BROKEN);
        assert.equal(cansee(13, 10), true);
    });
    void test(`${type === WAN_STRIKING ? 'striking wand' : 'force-bolt spell'} reveals and destroys a secret door`, async () => {
        freshDoor();
        const source = await knownObject(type);
        const door = doorAt(11, 10, D_NODOOR, SDOOR);
        assert.equal(await changeDoorByMagic(source, 11, 10), true);
        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_BROKEN);
    });
}

for (const trapped of [false, true] as const) {
    void test(`${trapped ? 'an exploding' : 'a broken'} empty door wakes monsters within its native noise radius without hurting the hero`, async () => {
        freshDoor();
        requireFixtureGame(game);
        const source = await knownObject(WAN_STRIKING);
        const near = await createMonsterAt('goblin', 14, 10, NO_MINVENT);
        const farther = await createMonsterAt('orc', 16, 10, NO_MINVENT);
        near.msleeping = farther.msleeping = 1;
        const door = doorAt(11, 10, D_CLOSED | (trapped ? D_TRAPPED : 0));
        const hp = game.u.uhp;
        await changeDoorByMagic(source, 11, 10);
        assert.equal(door.doormask, trapped ? D_NODOOR : D_BROKEN);
        assert.equal(near.msleeping, 0);
        assert.equal(farther.msleeping, trapped ? 0 : 1);
        assert.equal(game.u.uhp, hp);
    });
}

void test('a remotely exploded occupied door damages and stuns its monster and teaches surviving trap knowledge', async () => {
    freshDoor();
    const occupant = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    occupant.mhp = occupant.mhpmax = 50;
    const source = await knownObject(WAN_STRIKING);
    const door = doorAt(11, 10, D_CLOSED | D_TRAPPED);
    await changeDoorByMagic(source, 11, 10);
    assert.equal(door.doormask, D_NODOOR);
    assert.ok(occupant.mhp < 50 && occupant.mhp >= 35);
    assert.equal(occupant.mstun, 1);
    assert.ok((occupant.mtrapseen ?? 0) & (1 << (TRAPPED_DOOR - 1)));
});

for (const lifesaved of [false, true] as const) {
    void test(`door-explosion death ${lifesaved ? 'uses the monster amulet before learning the trap' : 'removes the monster without crediting a hero kill'}`, async () => {
        freshDoor();
        requireFixtureGame(game);
        const occupant = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        if (lifesaved) await equipMonsterObject(occupant, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        occupant.mhp = 1;
        const source = await knownObject(WAN_STRIKING);
        doorAt(11, 10, D_CLOSED | D_TRAPPED);
        const experience = game.u.uexp || 0;
        await changeDoorByMagic(source, 11, 10);
        assert.equal(monsterAtPosition(game.level, occupant.mx, occupant.my) === occupant, lifesaved);
        assert.equal(game.u.uexp || 0, experience);
        if (lifesaved) {
            assert.ok(occupant.mhp > 0);
            assert.ok((occupant.mtrapseen ?? 0) & (1 << (TRAPPED_DOOR - 1)));
            assert.ok(!occupant.minvent.some(item => item.otyp === AMULET_OF_LIFE_SAVING));
        }
    });
}

void test('the explosion message pauses before noise, stun, or damage are applied to the occupant', async () => {
    const input = freshDoor();
    const occupant = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    occupant.mhp = 50;
    occupant.mstun = 0;
    const source = await knownObject(WAN_STRIKING);
    const door = doorAt(11, 10, D_CLOSED | D_TRAPPED);
    await plineWithContinuation('An earlier announcement fills most of the message line now.');
    input.beforeRead = null;
    input.display = null;
    const changing = changeDoorByMagic(source, 11, 10);
    await input.waitUntilBlocked();
    assert.equal(door.doormask, D_NODOOR);
    assert.equal(occupant.mhp, 50);
    assert.equal(occupant.mstun, 0);
    installPagerInput(input, { expected: /door|trap|crash|shatter|explos|earlier announcement|medallion|looks much better|But wait/i, limit: 10 });
    input.feed(' ');
    assert.equal(await changing, true);
    assert.ok(occupant.mhp < 50);
});

void test('a changed door interrupts the matching lock occupation while an unchanged locked door does not', async () => {
    freshDoor();
    requireFixtureGame(game);
    const source = await knownObject(WAN_LOCKING);
    const door = doorAt(11, 10, D_LOCKED);
    const occupation: PickLockOccupation = { tool: await knownObject(LOCK_PICK), key: 'pick-lock', text: 'picking the lock', door, x: 11, y: 10,
        remaining: 51, usedtime: 5, chance: 10 };
    game._occupation = occupation;
    assert.equal(await changeDoorByMagic(source, 11, 10), false);
    assert.equal(game._occupation, occupation);
    await changeDoorByMagic(await knownObject(WAN_OPENING), 11, 10);
    assert.equal(game._occupation, null);
    await flush_screen();
    assert.ok(screen().includes('You stop picking the lock.'));
});

void test('breaking a shop entrance records repair damage while billing remains with ray traversal', async () => {
    freshDoor();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14, doorX: 11 });
    const source = await knownObject(WAN_STRIKING);
    doorAt(11, 10, D_CLOSED);
    await changeDoorByMagic(source, 11, 10);
    assert.ok(game.level.damagelist !== null && game.level.damagelist !== undefined);
    const repair = game.level.damagelist.find(record => record.place.x === 11 && record.place.y === 10);
    assert.ok(repair);
    assert.equal(repair.cost, 0);
    assert.equal(shopkeeper.eshk.debit, 0);
});


void test('a moving soldier reaches the same pageable door explosion owner before taking damage', async () => {
    const input = freshDoor({ left: 8, right: 14, top: 10, bottom: 10, heroX: 12 });
    requireFixtureGame(game);
    const soldier = await createMonsterAt('soldier', 9, 10, NO_MINVENT);
    soldier.mhp = soldier.mhpmax = 50;
    soldier.mstun = 0;
    soldier.movement = 12;
    const door = doorAt(10, 10, D_CLOSED | D_TRAPPED);
    initRng(1n);
    await plineWithContinuation('An earlier announcement fills most of the message line now.');
    input.beforeRead = null;
    input.display = null;
    const finishing = runMonsterAction(soldier, game);
    const blocked = await Promise.race([
        input.waitUntilBlocked().then(() => true), finishing.then(() => false),
    ]);
    try {
        assert.equal(blocked, true, 'Door explosion feedback must await the earlier message');
        assert.equal(soldier.mx, 10);
        assert.equal(door.doormask, D_NODOOR);
        assert.equal(soldier.mhp, 50);
        assert.equal(soldier.mstun, 0);
    } finally {
        installPagerInput(input, { expected: /door|trap|crash|shatter|explos|earlier announcement|medallion|looks much better|But wait/i, limit: 10 });
        input.feed(' ');
        await finishing;
    }
    assert.ok(soldier.mhp >= 35 && soldier.mhp < 50);
    assert.equal(soldier.mstun, 1);
    assert.ok((soldier.mtrapseen ?? 0) & (1 << (TRAPPED_DOOR - 1)));
});


for (const occupied of [false, true] as const) {
    void test(`a deaf unconscious hero does not hear ${occupied ? 'an occupied' : 'an empty'} door explosion`, async () => {
        freshDoor({ hero: { deafTurns: 20, usleep: 1 } });
        requireFixtureGame(game);
        game._helplessTurns = 2;
        if (occupied) await createMonsterAt('orc', 11, 10, NO_MINVENT);
        const source = await knownObject(WAN_STRIKING);
        const door = doorAt(11, 10, D_CLOSED | D_TRAPPED);
        await changeDoorByMagic(source, 11, 10);
        assert.equal(door.doormask, D_NODOOR);
        await flush_screen();
        assert.ok(!screen().includes('explosion'));
        assert.ok(!screen().includes('door explode'));
    });
}
