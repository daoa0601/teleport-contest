import { installPagerInput } from './support/pager-input.js';
import { floorObjectsAt } from './support/level-state.js';
import { createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR, AM_LAWFUL, BEAR_TRAP, CORR, DOOR, D_CLOSED, D_NODOOR, HOLE, HWALL, IRONBARS, LADDER, MM_NOGRP, NO_MINVENT, PIT, POOL, ROOM, SDOOR, SHOP_DOOR_COST, SHOP_WALL_COST, STONE, TREE, TT_PIT, W_NONDIGGABLE, } from '../js/const.js';
import { addBuriedObject } from '../js/buried_object.js';
import { zapDigWithObject } from '../js/digging_magic.js';
import { digActualHole } from '../js/digging_terrain.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { requireGameLevel, requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { BEARTRAP, BOULDER, DAGGER, HELMET, ROCK, SPE_DIG, WAN_DIGGING } from '../js/object_data.js';
import { connectPits, pitsAreConjoined } from '../js/pit_connections.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
function diggingRoom(options = {}) {
    const level = freshObjectRoom({ right: 25, ...options });
    requireFixtureGame(game);
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    const input = resetInputState();
    const messages = [];
    let reads = 0;
    installPagerInput(input, { expected: /dig|pit|hole|wall|door|tree|fountain|ceiling|floor|rock|boulder|statue|altar|shop|pay|damage|watch|arrest|leash|trap|collapse|expelled from Juiblex/i, limit: 120 });
    input.beforeRead = () => {
        if (++reads > 80)
            throw new Error(`Unexpected digging input: ${game._pending_message}`);
        messages.push(game._pending_message || '');
    };
    return { level, input, messages };
}
async function diggingObject(otyp = WAN_DIGGING) {
    return knownObject(otyp, { initialize: false });
}
async function trappedHero() {
    const pit = await maketrap(game.u.ux, game.u.uy, PIT);
    game.u.utrap = 5;
    game.u.utraptype = TT_PIT;
    assert.ok(pit);
    return pit;
}
for (const otyp of [WAN_DIGGING, SPE_DIG]) {
    void test(`${otyp === SPE_DIG ? 'a spell' : 'a wand'} digs using the live hero direction`, async () => {
        const { level } = diggingRoom();
        requireFixtureGame(game);
        game.u.dx = 0;
        game.u.dy = -1;
        level.requireAt(10, 9).typ = HWALL;
        level.requireAt(11, 10).typ = HWALL;
        await zapDigWithObject(await diggingObject(otyp));
        assert.equal(level.requireAt(10, 9).typ, DOOR);
        assert.equal(level.requireAt(10, 9).doormask, D_NODOOR);
        assert.equal(level.requireAt(11, 10).typ, HWALL);
    });
}
void test('ordinary digging opens a wall and updates visibility beyond it', async () => {
    const { level } = diggingRoom();
    for (let y = 6; y <= 14; y++)
        level.requireAt(11, y).typ = HWALL;
    vision_reset();
    vision_recalc(0);
    assert.equal(cansee(12, 10), false);
    await zapDigWithObject(await diggingObject());
    vision_recalc(0);
    assert.equal(level.requireAt(11, 10).typ, DOOR);
    assert.equal(cansee(12, 10), true);
});
void test('a cavern wall becomes corridor and an ordinary tree becomes floor', async () => {
    const { level } = diggingRoom();
    level.flags.is_cavernous_lev = true;
    level.requireAt(11, 10).typ = HWALL;
    level.requireAt(12, 10).typ = TREE;
    await zapDigWithObject(await diggingObject());
    assert.equal(level.requireAt(11, 10).typ, CORR);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
});
void test('nondiggable ordinary rock stops the beam before later terrain', async () => {
    const { level } = diggingRoom();
    const rock = level.requireAt(11, 10);
    rock.typ = STONE;
    rock.wall_info = W_NONDIGGABLE;
    level.requireAt(12, 10).typ = HWALL;
    await zapDigWithObject(await diggingObject());
    assert.equal(level.requireAt(11, 10).typ, STONE);
    assert.equal(level.requireAt(12, 10).typ, HWALL);
});
for (const terrain of [HWALL, TREE, STONE, SDOOR]) {
    void test(`maze digging stops after opening terrain ${terrain}`, async () => {
        const { level } = diggingRoom();
        level.flags.is_maze_lev = true;
        level.requireAt(11, 10).typ = terrain;
        level.requireAt(12, 10).typ = HWALL;
        await zapDigWithObject(await diggingObject());
        assert.equal(level.requireAt(11, 10).typ, terrain === STONE ? CORR : terrain === SDOOR ? DOOR : ROOM);
        assert.equal(level.requireAt(12, 10).typ, HWALL);
    });
}
void test('Earth ignores the maze stopping rule', async () => {
    const { level } = diggingRoom();
    requireFixtureGame(game);
    level.flags.is_maze_lev = true;
    game.earth_level = createSpecialLevel({ ...game.u.uz });
    level.requireAt(11, 10).typ = HWALL;
    level.requireAt(12, 10).typ = HWALL;
    await zapDigWithObject(await diggingObject());
    assert.equal(level.requireAt(11, 10).typ, DOOR);
    assert.equal(level.requireAt(12, 10).typ, DOOR);
});
void test('upward digging respects helmets, half damage, and places the falling rock', async () => {
    diggingRoom();
    requireFixtureGame(game);
    game.u.dz = -1;
    game.uarmh = await knownObject(HELMET);
    grantIntrinsicProperty('halfPhysicalDamage', 'outside');
    const hp = game.u.uhp;
    await zapDigWithObject(await diggingObject());
    assert.equal(game.u.uhp, hp - 1);
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).some(object => object.otyp === ROCK && object.dknown));
});
void test('a downward beam striking a ladder falls back as rock', async () => {
    const { level, messages } = diggingRoom();
    requireFixtureGame(game);
    level.requireAt(10, 10).typ = LADDER;
    game.stairs = { sx: 10, sy: 10, isladder: true, up: false,
        u_traversed: false, tolev: { dnum: 0, dlevel: 2 }, next: null };
    game.u.dz = 1;
    await zapDigWithObject(await diggingObject());
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).some(object => object.otyp === ROCK));
    assert.match(messages.join(' '), /bounces off the ladder/);
    assert.equal(level.traps.length, 0);
});
for (const environment of ['underwater', 'air_level', 'water_level']) {
    void test(`vertical digging has no effect ${environment}`, async () => {
        diggingRoom();
        requireFixtureGame(game);
        if (environment === 'underwater')
            game.u.uinwater = 1;
        else
            game[environment] = createSpecialLevel({ ...game.u.uz });
        game.u.dz = -1;
        const hp = game.u.uhp;
        await zapDigWithObject(await diggingObject());
        assert.equal(game.u.uhp, hp);
        assert.equal(floorObjectsAt(requireGameLevel(game), 10, 10)?.length || 0, 0);
        assert.equal(game._pending_message || '', '');
    });
}
void test('digging down disarms a bear trap while opening a pit in a hard floor', async () => {
    const { level } = diggingRoom();
    requireFixtureGame(game);
    game.u.dz = 1;
    level.flags.hardfloor = true;
    grantIntrinsicProperty('levitation', 'outside');
    await maketrap(10, 10, BEAR_TRAP);
    makeEngravingAt(10, 10, 'Elbereth');
    await zapDigWithObject(await diggingObject());
    assert.ok(level.traps.some(trap => trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT));
    assert.ok(floorObjectsAt(level, 10, 10).some(object => object.otyp === BEARTRAP));
    assert.equal(engravingAt(10, 10), null);
});
void test('digging down opens a hole below a levitating hero', async () => {
    const { level } = diggingRoom();
    requireFixtureGame(game);
    game.u.dz = 1;
    grantIntrinsicProperty('levitation', 'outside');
    await zapDigWithObject(await diggingObject());
    assert.ok(level.traps.some(trap => trap.tx === 10 && trap.ty === 10 && trap.ttyp === HOLE));
    assert.equal(game.u.uz.dlevel, 8);
});
void test('digging from a pit opens one adjacent pit, exposing buried objects', async () => {
    const { level } = diggingRoom();
    const ownPit = await trappedHero();
    const dagger = await knownObject(DAGGER);
    addBuriedObject(dagger, 11, 10);
    makeEngravingAt(11, 10, 'buried');
    await zapDigWithObject(await diggingObject());
    const adjacent = level.traps.find(trap => trap.tx === 11 && trap.ty === 10);
    assert.ok(adjacent !== null && adjacent !== undefined);
    assert.equal(adjacent.ttyp, PIT);
    assert.equal(pitsAreConjoined(ownPit, adjacent), true);
    assert.equal(level.traps.some(trap => trap.tx === 12 && trap.ty === 10), false);
    assert.equal(dagger.where, 'floor');
    assert.equal(engravingAt(11, 10), null);
});
void test('a beam through an already connected pit links the newly reached pit back', async () => {
    const { level } = diggingRoom();
    const ownPit = await trappedHero();
    const adjacent = await maketrap(11, 10, PIT);
    assert.ok(adjacent);
    connectPits(ownPit, adjacent);
    await zapDigWithObject(await diggingObject());
    const nextPit = level.traps.find(trap => trap.tx === 12 && trap.ty === 10);
    assert.ok(nextPit !== null && nextPit !== undefined);
    assert.equal(nextPit.ttyp, PIT);
    assert.equal(pitsAreConjoined(ownPit, nextPit), true);
});
void test('pit-side digging is blocked by a wall foundation and iron bars', async () => {
    for (const terrain of [HWALL, IRONBARS]) {
        const { level, messages } = diggingRoom();
        requireFixtureGame(game);
        await trappedHero();
        level.requireAt(11, 10).typ = terrain;
        await zapDigWithObject(await diggingObject());
        assert.equal(level.traps.length, 1);
        assert.equal(level.requireAt(11, 10).typ, terrain);
        assert.match([...messages, game._pending_message].join(' '), terrain === HWALL ? /foundation is too hard/ : /bars go much deeper/);
    }
});
void test('pit-side digging of a boulder consumes the boulder instead of making a pit', async () => {
    const { level } = diggingRoom();
    await trappedHero();
    const boulder = await floorObject(BOULDER, 11, 10);
    await zapDigWithObject(await diggingObject());
    assert.equal(level.traps.length, 1);
    assert.equal(floorObjectsAt(level, 11, 10).includes(boulder), false);
});
void test('opening a pit into water floods every connected pit and releases its occupants', async () => {
    const { level, input } = diggingRoom();
    installPagerInput(input, { expected: /pit|water/, limit: 4 });
    requireFixtureGame(game);
    grantIntrinsicProperty('swimming', 'outside');
    const ownPit = await trappedHero();
    const otherPit = await maketrap(10, 11, PIT);
    assert.ok(otherPit);
    connectPits(ownPit, otherPit);
    const swimmer = await createMonsterAt('crocodile', 10, 11, MM_NOGRP | NO_MINVENT);
    swimmer.mtrapped = 1;
    level.requireAt(11, 10).typ = POOL;
    await zapDigWithObject(await diggingObject());
    assert.equal(level.requireAt(10, 10).typ, POOL);
    assert.equal(level.requireAt(10, 11).typ, POOL);
    assert.equal(level.traps.length, 0);
    assert.equal(game.u.utrap, 0);
    assert.equal(swimmer.mtrapped, 0);
    assert.ok(swimmer.mhp > 0);
});
for (const [species, remainingHp] of [['purple worm', 1], ['Juiblex', 11]]) {
    void test(`digging escapes ${species} without killing its holder`, async () => {
        diggingRoom();
        requireFixtureGame(game);
        const holder = await createMonsterAt(species, 10, 10, MM_NOGRP | NO_MINVENT);
        holder.mhp = 21;
        game.u.uswallow = true;
        game.u.ustuck = holder;
        await zapDigWithObject(await diggingObject());
        assert.equal(holder.mhp, remainingHp);
        assert.equal(!!game.u.uswallow, false);
        assert.equal(game.u.ustuck, null);
        assert.notEqual(`${holder.mx},${holder.my}`, '10,10');
    });
}
void test('a whirling engulfer is unaffected by digging', async () => {
    diggingRoom();
    requireFixtureGame(game);
    const holder = await createMonsterAt('air elemental', 10, 10, MM_NOGRP | NO_MINVENT);
    const hp = holder.mhp;
    game.u.uswallow = true;
    game.u.ustuck = holder;
    await zapDigWithObject(await diggingObject());
    assert.equal(game.u.uswallow, true);
    assert.equal(game.u.ustuck, holder);
    assert.equal(holder.mhp, hp);
});
void test('a visible town wall dug by magic brings the watch under arrest orders', async () => {
    const { level } = diggingRoom();
    level.flags.has_town = true;
    const guard = await createMonsterAt('watchman', 10, 9, MM_NOGRP | NO_MINVENT);
    guard.mpeaceful = 1;
    level.requireAt(11, 10).typ = HWALL;
    await zapDigWithObject(await diggingObject());
    assert.equal(level.requireAt(11, 10).typ, DOOR);
    assert.equal(guard.mpeaceful, 0);
});
for (const [terrain, cost] of [[DOOR, SHOP_DOOR_COST], [HWALL, SHOP_WALL_COST]]) {
    void test(`digging shop terrain ${terrain} records repairs and angers an unpaid keeper`, async () => {
        const { level } = diggingRoom();
        const { shopkeeper } = await createStaffedShop({ keeperX: 10, keeperY: 9,
            doorX: 11, doorY: 10 });
        const target = level.requireAt(11, 10);
        target.typ = terrain;
        target.doormask = D_CLOSED;
        await zapDigWithObject(await diggingObject());
        assert.ok(level.damagelist !== null && level.damagelist !== undefined);
        const damage = level.damagelist.find(record => record.place.x === 11 && record.place.y === 10);
        assert.ok(damage !== null && damage !== undefined);
        assert.equal(damage.cost, cost);
        assert.equal(shopkeeper.mpeaceful, 0);
        assert.equal(level.requireAt(11, 10).doormask, D_NODOOR);
    });
}
void test('falling-rock damage waits until its message has been acknowledged', async () => {
    const { input } = diggingRoom();
    requireFixtureGame(game);
    input.beforeRead = null;
    input.display = null;
    requireGameDisplay(game).terminal.cols = 50;
    game.u.dz = -1;
    const hp = game.u.uhp;
    const object = await diggingObject();
    const effect = zapDigWithObject(object);
    await input.waitUntilBlocked();
    assert.equal(game.u.uhp, hp);
    assert.equal(floorObjectsAt(requireGameLevel(game), 10, 10)?.length || 0, 0);
    input.feed(' '.repeat(12));
    await effect;
    assert.ok(game.u.uhp < hp);
    assert.ok(floorObjectsAt(requireGameLevel(game), 10, 10).some(rock => rock.otyp === ROCK));
});
void test('an actual pit destroying an altar retains its original alignment in the message', async () => {
    const { level, messages } = diggingRoom();
    requireFixtureGame(game);
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.flags = AM_LAWFUL;
    await digActualHole(12, 10, null, PIT);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
    assert.ok(level.traps.some(trap => trap.tx === 12 && trap.ty === 10 && trap.ttyp === PIT));
    assert.match([...messages, game._pending_message].join(' '), /lawful altar falls into the pit/);
});
//# sourceMappingURL=digging_magic.test.js.map