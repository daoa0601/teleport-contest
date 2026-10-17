import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { DOOR, D_CLOSED, D_ISOPEN, HOLE, IRONBARS, LANDMINE, LAVAPOOL, LEVEL_TELEP, PIT, POOL, ROLLING_BOULDER_TRAP, ROOM, STONE, TELEP_TRAP, TRAPDOOR, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BOULDER, DAGGER, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
function pushRoom() {
    const level = freshObjectRoom({ flags: { pickup: false, verbose: true } });
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        assert.ok(++reads < 30, `Unexpected push prompt: ${game._pending_message}`);
        input.feed(' ');
    };
    return level;
}
for (const terrain of [LAVAPOOL, POOL]) {
    void test(`pushing a boulder into ${terrain === LAVAPOOL ? 'lava consumes it without filling the lava' : 'water fills a crossing'}`, async () => {
        const level = pushRoom();
        level.requireAt(12, 10).typ = terrain;
        const sleeper = terrain === POOL ? await createMonsterAt('newt', 15, 10) : null;
        if (sleeper)
            sleeper.msleeping = 1;
        const boulder = await floorObject(BOULDER, 11, 10);
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.equal(boulder.where, 'gone');
        assert.equal(game.u.ux, 11);
        assert.equal(level.requireAt(12, 10).typ, terrain === POOL ? ROOM : LAVAPOOL);
        assert.match(game._pending_message, terrain === POOL ? /Now you can cross it!/ : /It sinks without a trace!/);
        if (sleeper)
            assert.equal(sleeper.msleeping, 1, 'filling water by pushing causes no splash');
    });
}
for (const { name, message } of [
    { name: 'Boots', message: 'Boots push the boulder into the pool of water.' },
    { name: 'Clover', message: 'Clover pushes the boulder into the pool of water.' },
]) {
    void test(`a steed named ${name} fills a pool with the native verb agreement`, async () => {
        const level = pushRoom();
        const steed = await createSaddledSteed('pony', { x: 10, y: 10 });
        steed.mgivenname = name;
        game.u.usteed = steed;
        game.flags.verbose = false;
        level.requireAt(12, 10).typ = POOL;
        const boulder = await floorObject(BOULDER, 11, 10);
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.ok(game._pending_message.includes(message), game._pending_message);
        assert.equal(level.requireAt(12, 10).typ, ROOM);
        assert.equal(boulder.where, 'gone');
        assert.equal(game.u.ux, 11);
    });
}
void test('pushing a boulder into a pit fills it and buries its floor pile', async () => {
    const level = pushRoom();
    const pit = addTrap(level, PIT, 12, 10);
    const dagger = await floorObject(DAGGER, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(level.traps.includes(pit), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(dagger.where, 'buried');
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /The boulder fills a pit\./);
});
void test('pushing a boulder plugs a hole and makes its floor diggable', async () => {
    const level = pushRoom();
    const hole = addTrap(level, HOLE, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(level.traps.includes(hole), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(level.requireAt(12, 10).candig, 1);
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /falls into and plugs a hole in the floor!/);
});
void test('a level teleport trap sends the pushed boulder away and reveals the trap', async () => {
    const level = pushRoom();
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 25 })];
    const trap = addTrap(level, LEVEL_TELEP, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.where, 'migrating');
    assert.ok(game.migratingObjects?.includes(boulder));
    assert.notEqual(boulder.migration?.destination.dlevel, 8);
    assert.equal(trap.tseen, true);
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /You push the boulder and suddenly it disappears!/);
});
void test('a deaf hero blocked by an unseen monster gets the direct refusal', async () => {
    pushRoom();
    await addInventoryObject(ROCK, { quan: 30 });
    const monster = await createMonsterAt('newt', 12, 10);
    monster.minvis = true;
    game.u.deafTurns = 10;
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(boulder.ox, 11);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'You cannot move the boulder.');
});
void test('Sokoban refuses a diagonal boulder push', async () => {
    const level = pushRoom();
    level.flags.sokoban_rules = true;
    await addInventoryObject(ROCK, { quan: 30 });
    const boulder = await floorObject(BOULDER, 11, 11);
    await rhack('n'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(boulder.ox, 11);
    assert.equal(boulder.oy, 11);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /The boulder won't roll diagonally on this floor\./);
});
void test('a naked hero can squeeze past an immovable Sokoban boulder with a luck penalty', async () => {
    const level = pushRoom();
    level.flags.sokoban_rules = true;
    level.requireAt(12, 10).typ = STONE;
    const boulder = await floorObject(BOULDER, 11, 10);
    const luck = game.u.uluck ?? 0;
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 11);
    assert.equal(boulder.ox, 11);
    assert.equal(game.u.uluck, luck - 1);
    assert.equal(game.u.uconduct?.sokocheat, 1);
});
for (const obstacle of [STONE, IRONBARS, D_CLOSED, D_ISOPEN]) {
    void test(`a loaded hero cannot push a boulder ${obstacle === STONE ? 'into rock' : obstacle === IRONBARS ? 'through bars' : obstacle === D_CLOSED ? 'through a closed door' : 'diagonally into an open doorway'}`, async () => {
        const level = pushRoom();
        const diagonal = obstacle === D_ISOPEN;
        const target = level.requireAt(12, diagonal ? 12 : 10);
        target.typ = obstacle === D_CLOSED || obstacle === D_ISOPEN ? DOOR : obstacle;
        if (target.typ === DOOR)
            target.doormask = obstacle;
        await addInventoryObject(ROCK, { quan: 30 });
        const boulder = await floorObject(BOULDER, 11, diagonal ? 11 : 10);
        game.multi = 8;
        await rhack((diagonal ? 'n' : 'l').charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(boulder.ox, 11);
        assert.equal(game.context.move, 0);
        assert.equal(game.multi, 0);
        assert.match(game._pending_message, /You try to move the boulder, but in vain\./);
    });
}
void test('a pit consumes one boulder and leaves the rest blocking the hero', async () => {
    const level = pushRoom();
    const pit = addTrap(level, PIT, 12, 10);
    const remaining = await floorObject(BOULDER, 11, 10);
    const falling = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(falling.where, 'gone');
    assert.equal(remaining.ox, 11);
    assert.equal(game.u.ux, 10);
    assert.equal(level.traps.includes(pit), false);
});
void test('successive boulders on the source square are each pushed into lava', async () => {
    const level = pushRoom();
    level.requireAt(12, 10).typ = LAVAPOOL;
    const first = await floorObject(BOULDER, 11, 10);
    const second = await floorObject(BOULDER, 11, 10);
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(first.where, 'gone');
    assert.equal(second.where, 'gone');
    assert.equal(game.u.ux, 11);
});
void test('a same-level teleport leaves the pushed boulder on its trap', async () => {
    const level = pushRoom();
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 25 })];
    const trap = addTrap(level, LEVEL_TELEP, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, 12);
    assert.equal(trap.tseen, false);
    assert.equal(game.u.ux, 11);
    assert.match(game._pending_message, /With great effort you move the boulder\./);
});
void test('a teleport trap relocates the pushed boulder within the level', async () => {
    const level = pushRoom();
    const trap = addTrap(level, TELEP_TRAP, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.where, 'floor');
    assert.ok(boulder.ox !== 11 || boulder.oy !== 10);
    assert.equal(trap.tseen, true);
    assert.equal(game.u.ux, 11);
});
void test('a pushed boulder triggers and plugs a concealed trap door', async () => {
    const level = pushRoom();
    const trap = addTrap(level, TRAPDOOR, 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(level.traps.includes(trap), false);
    assert.equal(boulder.where, 'gone');
    assert.match(game._pending_message, /The boulder triggers and plugs a trap door in the floor!/);
});
void test('a pushed boulder sets off a land mine', async () => {
    const level = pushRoom();
    const trap = addTrap(level, LANDMINE, 12, 10);
    await floorObject(BOULDER, 11, 10);
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    assert.ok(!level.traps.includes(trap) || trap.ttyp !== LANDMINE);
    assert.ok(!level.objects[11]?.[10]?.some(object => object.otyp === BOULDER));
});
void test('an unsolid air elemental still blocks a boulder', async () => {
    pushRoom();
    await addInventoryObject(ROCK, { quan: 30 });
    await createMonsterAt('air elemental', 12, 10);
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.ox, 11);
    assert.equal(game.u.ux, 10);
});
void test('levitation prevents a push even when the hero could squeeze past', async () => {
    pushRoom();
    grantIntrinsicProperty('levitation', 'outside');
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.ox, 11);
    assert.equal(game.u.ux, 10);
    assert.match(game._pending_message, /don't have enough leverage/);
});
void test('a tiny form squeezes beside a boulder instead of pushing it', async () => {
    pushRoom();
    await polymonHero(MONSTER_NAME.indexOf('newt'));
    game._pending_message = '';
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.ox, 11);
    assert.equal(game.u.ux, 11);
});
void test('a boulder fills the pit beneath a trapped monster and releases it', async () => {
    const level = pushRoom();
    const pit = addTrap(level, PIT, 12, 10);
    const monster = await createMonsterAt('newt', 12, 10);
    monster.mtrapped = 1;
    monster.mhp = monster.mhpmax = 100;
    const boulder = await floorObject(BOULDER, 11, 10);
    initRng(9n);
    await rhack('l'.charCodeAt(0));
    assert.equal(monster.mtrapped, 0);
    assert.ok(monster.mhp < 100);
    assert.equal(level.traps.includes(pit), false);
    assert.equal(boulder.where, 'gone');
    assert.equal(game.u.ux, 11);
});
void test('pushing onto a rolling-boulder trap launches the boulder toward its endpoint', async () => {
    const level = pushRoom();
    const trap = addTrap(level, ROLLING_BOULDER_TRAP, 12, 10, { launch: { x: 14, y: 10 } });
    const boulder = await floorObject(BOULDER, 11, 10);
    await rhack('l'.charCodeAt(0));
    assert.equal(boulder.where, 'floor');
    assert.equal(boulder.ox, 14);
    assert.equal(trap.tseen, true);
    assert.equal(game.u.ux, 11);
});
//# sourceMappingURL=push_boulder.test.js.map