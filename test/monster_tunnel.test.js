import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CHA, CORR, DOOR, D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, HWALL, NO_MINVENT, ROOM, SCORR, SDOOR, STONE, TREE, W_AMUL, W_NONDIGGABLE, } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { putHeroToSleep } from '../js/hero_sleep.js';
import { digMonsterTunnel } from '../js/monster_tunnel.js';
import { AMULET_OF_LIFE_SAVING, APPLE, BOULDER, ROCK, } from '../js/object_data.js';
import { couldsee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
import { createRoom, createSpecialLevel } from './support/topology.js';
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
void test('a sleeping hero dreams about the draft from an opened secret corridor', async () => {
    const { monster } = await tunnelRoom(SCORR);
    requirePlayingGame(game);
    await putHeroToSleep(3);
    await digMonsterTunnel(monster, game);
    await flush_screen(1);
    assert.equal(game._pending_message, 'You dream that you feel a draft.');
});
async function tunnelRoom(terrain) {
    const level = freshPlayableRoom({ flags: { verbose: true, acoustics: true } });
    const monster = await createMonsterAt('rock mole', 12, 10, NO_MINVENT);
    monster.mhp = monster.mhpmax = 30;
    const location = level.requireAt(12, 10);
    location.typ = terrain;
    vision_note_blocker_change(12, 10);
    vision_recalc(0);
    return { level, monster, location, input: resetInputState() };
}
void test('crashing rock pages preceding prose before the wall becomes a doorway', async () => {
    const { level, monster, location, input } = await tunnelRoom(HWALL);
    requirePlayingGame(game);
    await plineWithContinuation('You wait while the sound of distant footsteps echoes down the passage.');
    const digging = digMonsterTunnel(monster, game, { random: () => 0, rollOne: () => 12 });
    try {
        await input.waitUntilBlocked();
        assert.match(visibleText(), /distant footsteps.*--More--/);
        assert.equal(location.typ, HWALL, 'the old message suspends the wall-breaking announcement');
        assert.equal(floorObjectsAt(level, 12, 10).length, 0);
    }
    finally {
        input.feed(' ');
        await digging;
    }
    await flush_screen(1);
    assert.match(visibleText(), /You hear crashing rock\./);
    assert.equal(location.typ, DOOR);
    assert.equal(location.doormask, D_NODOOR);
});
for (const { name, maze, cavernous, town, expected } of [
    { name: 'maze', maze: true, cavernous: false, town: false, expected: ROOM },
    { name: 'cavern', maze: false, cavernous: true, town: false, expected: CORR },
    { name: 'town cavern', maze: false, cavernous: true, town: true, expected: DOOR },
]) {
    void test(`a tunneled wall in a ${name} becomes its native passage terrain`, async () => {
        const { level, monster, location } = await tunnelRoom(HWALL);
        requirePlayingGame(game);
        level.flags.is_maze_lev = maze;
        level.flags.is_cavernous_lev = cavernous;
        level.flags.has_town = town;
        await digMonsterTunnel(monster, game, { random: () => 1, rollOne: () => 12 });
        assert.equal(location.typ, expected);
        assert.equal(location.flags, 0);
    });
}
void test('cavern walls outside the actual town boundary become corridors', async () => {
    const { level, monster, location } = await tunnelRoom(HWALL);
    requirePlayingGame(game);
    level.flags.is_cavernous_lev = level.flags.has_town = true;
    level.rooms.push(createRoom({ lx: 30, hx: 35, ly: 8, hy: 12, nsubrooms: 1 }));
    await digMonsterTunnel(monster, game, { random: () => 1, rollOne: () => 12 });
    assert.equal(location.typ, CORR);
});
for (const { pile, type } of [{ pile: 1, type: BOULDER }, { pile: 2, type: ROCK }]) {
    void test(`stone tunneling leaves ${type === BOULDER ? 'a blocking boulder' : 'ordinary rocks'}`, async () => {
        const { level, monster, location } = await tunnelRoom(STONE);
        requirePlayingGame(game);
        await digMonsterTunnel(monster, game, { rollOne: () => pile });
        const debris = floorObjectsAt(level, 12, 10);
        assert.equal(debris.length, 1);
        assert.equal(debris[0]?.otyp, type);
        assert.equal(debris[0]?.where, 'floor');
        assert.equal(location.typ, CORR);
        vision_recalc(0);
        assert.equal(couldsee(13, 10), type !== BOULDER, 'only the boulder keeps the opened tunnel opaque');
    });
}
void test('a tunnel can leave no debris and ordinary floor remains intact', async () => {
    const { level, monster, location } = await tunnelRoom(STONE);
    requirePlayingGame(game);
    await digMonsterTunnel(monster, game, { rollOne: () => 12 });
    assert.equal(location.typ, CORR);
    assert.equal(floorObjectsAt(level, 12, 10).length, 0);
    location.typ = ROOM;
    await digMonsterTunnel(monster, game, { rollOne: () => 1 });
    assert.equal(location.typ, ROOM);
    assert.equal(floorObjectsAt(level, 12, 10).length, 0);
});
for (const arboreal of [false, true]) {
    void test(`${arboreal ? 'arboreal stone' : 'a tree'} becomes room floor with real tree fruit`, async () => {
        const { level, monster, location } = await tunnelRoom(arboreal ? STONE : TREE);
        requirePlayingGame(game);
        level.flags.arboreal = arboreal;
        await digMonsterTunnel(monster, game, { rollOne: () => 2, random: () => 0 });
        const fruit = floorObjectsAt(level, 12, 10);
        assert.equal(location.typ, ROOM);
        assert.equal(fruit.length, 1);
        assert.equal(fruit[0]?.otyp, APPLE);
        assert.equal(fruit[0]?.where, 'floor');
        assert.ok((fruit[0]?.owt ?? 0) > 0);
    });
}
void test('a secret corridor is opened and reports its draft even without verbose messages', async () => {
    const { monster, location } = await tunnelRoom(SCORR);
    requirePlayingGame(game);
    game.flags.verbose = false;
    location.flags = 5;
    await digMonsterTunnel(monster, game, { rollOne: () => 12 });
    await flush_screen(1);
    assert.equal(location.typ, CORR);
    assert.equal(location.flags, 0);
    assert.match(visibleText(), /You feel a draft\./);
});
for (const locked of [false, true]) {
    void test(`a ${locked ? 'locked' : 'closed'} secret door is exposed and chewed into a broken door`, async () => {
        const { monster, location } = await tunnelRoom(SDOOR);
        requirePlayingGame(game);
        location.doormask = locked ? D_LOCKED : 3;
        location.arboreal_sdoor = 1;
        await digMonsterTunnel(monster, game, { random: () => 0, rollOne: () => 12 });
        await flush_screen(1);
        assert.equal(location.typ, DOOR);
        assert.equal(location.doormask, D_BROKEN);
        assert.equal(location.arboreal_sdoor, 0);
        assert.match(visibleText(), /You feel an unexpected draft\./);
    });
}
void test('a Rogue secret door becomes an untrapped open doorway', async () => {
    const { monster, location } = await tunnelRoom(SDOOR);
    requirePlayingGame(game);
    game.rogue_level = createSpecialLevel({ ...game.u.uz });
    location.doormask = D_LOCKED | D_TRAPPED;
    await digMonsterTunnel(monster, game, { rollOne: () => 12 });
    assert.equal(location.typ, DOOR);
    assert.equal(location.doormask, D_NODOOR);
    assert.equal(monster.mhp, 30);
});
void test('a sleeping hero does not feel an unexpected door draft', async () => {
    const { monster, location } = await tunnelRoom(DOOR);
    requirePlayingGame(game);
    location.doormask = D_CLOSED;
    game._helplessTurns = 3;
    game.u.usleep = game.moves;
    await digMonsterTunnel(monster, game, { random: () => 0, rollOne: () => 12 });
    await flush_screen(1);
    assert.equal(location.doormask, D_BROKEN);
    assert.doesNotMatch(visibleText(), /draft/);
});
for (const weak of [false, true]) {
    void test(`hallucinated door drafts classify an ${weak ? 'unfit' : 'able'} hero`, async () => {
        const { monster, location } = await tunnelRoom(DOOR);
        requirePlayingGame(game);
        location.doormask = D_CLOSED;
        game.u.hallucinationTurns = 10;
        if (weak) {
            const attributes = game.u.acurr;
            assert.ok(attributes);
            attributes.a[A_CHA] = 5;
        }
        await digMonsterTunnel(monster, game, { random: () => 0, rollOne: () => 12 });
        await flush_screen(1);
        assert.match(visibleText(), weak ? /You feel like you are 4-F\./ : /You feel like you are 1-A\./);
    });
}
for (const { alignment, record, reaction } of [
    { alignment: 1, record: 4, reaction: 'enlisting' },
    { alignment: 0, record: 4, reaction: 'marching' },
    { alignment: -1, record: 4, reaction: 'protesting' },
    { alignment: -1, record: 0, reaction: 'enlisting' },
]) {
    void test(`a hallucinated corridor draft reflects alignment ${alignment}, record ${record}`, async () => {
        const { monster } = await tunnelRoom(SCORR);
        requirePlayingGame(game);
        game.u.hallucinationTurns = 10;
        game.u.ualign.type = alignment;
        game.u.ualign.record = record;
        await digMonsterTunnel(monster, game, { random: () => 0, rollOne: () => 12 });
        await flush_screen(1);
        assert.ok(visibleText().includes(`You feel like ${reaction}.`), `Expected a draft reaction of ${reaction}, received: ${visibleText().split('\n')[0]}`);
    });
}
void test('shop doors retain a zero-cost repair record when a monster tunnels through them', async () => {
    const { level, monster, location } = await tunnelRoom(DOOR);
    requirePlayingGame(game);
    await createStaffedShop({ keeperX: 14, keeperY: 10, doorX: 12, doorY: 10 });
    location.typ = DOOR;
    location.doormask = D_CLOSED;
    await digMonsterTunnel(monster, game, { random: () => 1, rollOne: () => 12 });
    const repair = level.damagelist?.find(damage => damage.place.x === 12 && damage.place.y === 10);
    assert.ok(repair);
    assert.equal(repair.cost, 0);
    assert.equal(repair.typ, DOOR);
    assert.equal(location.doormask, D_BROKEN);
});
for (const lifeSaving of [false, true]) {
    void test(`a tunneled door trap ${lifeSaving ? 'consumes real life saving' : 'kills its tunneler'}`, async () => {
        const { level, monster, location, input } = await tunnelRoom(DOOR);
        requirePlayingGame(game);
        const amulet = lifeSaving ? await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
        location.doormask = D_CLOSED | D_TRAPPED;
        monster.mhp = 1;
        installPagerInput(input, { expected: /KABOOM|explosion|rock mole|amulet|medallion|But wait|looks much better/i, limit: 8 });
        const result = await digMonsterTunnel(monster, game, { rollOne: () => 12 });
        assert.equal(result.died, !lifeSaving);
        assert.equal(result.heroDied, false);
        assert.equal(location.doormask, D_NODOOR);
        assert.equal(monster.dead || monster.mhp <= 0, !lifeSaving);
        if (amulet) {
            assert.equal(amulet.where, 'gone');
            assert.ok(level.monsters.includes(monster));
            assert.ok(monster.mhp > 0);
        }
        else
            assert.notEqual(monsterAtPosition(level, monster.mx, monster.my), monster);
    });
}
void test('undiggable terrain reports the native impossible condition and remains intact', async () => {
    const { monster, location, input } = await tunnelRoom(HWALL);
    requirePlayingGame(game);
    location.wall_info = W_NONDIGGABLE;
    let reported = false;
    input.beforeRead = () => {
        if (visibleText().includes('mdig_tunnel:  wall at (12,10) is undiggable'))
            reported = true;
    };
    installPagerInput(input, { expected: /undiggable|Program in disorder|Please report/, limit: 4 });
    const result = await digMonsterTunnel(monster, game, { rollOne: () => 12 });
    assert.equal(reported, true);
    assert.equal(location.typ, HWALL);
    assert.equal(monster.mhp, 30);
    assert.equal(result.died, false);
});
//# sourceMappingURL=monster_tunnel.test.js.map