import test from 'node:test';
import assert from 'node:assert/strict';
import { DELPHI, DOOR, D_CLOSED, LAVAPOOL, NO_MINVENT, OROOM, ROCKTRAP, ROOMOFFSET, ROLLING_BOULDER_TRAP, RUST_TRAP } from '../js/const.js';
import { canSeeMonster, canSpotMonster, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { MONSTER_DIFFICULTY, MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm, decideMonsterShapeChange } from '../js/monster_polymorph.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { launchRollingBoulder } from '../js/rolling_boulder.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from '../js/rust_trap.js';
import { checkSpecialRoom } from '../js/shk.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createRoom } from './support/topology.js';
function topline() {
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
void test('a sighted hero names the falling rock when a ceiling trap opens', async () => {
    const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const trap = addTrap(level, ROCKTRAP, game.u.ux, game.u.uy);
    await triggerHeroTrap(trap);
    await flush_screen();
    assert.equal(topline(), 'A trap door in the ceiling opens and a rock falls on your head!');
});
void test('a resumed game sees its pet before searching beside it', async () => {
    const input = {
        seed: 23, datetime: '20020807080000', storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Listener,role:ranger,race:orc,gender:male,align:chaotic\nOPTIONS=!legacy,!tutorial,!news,!autopickup',
    };
    await runSegment({ ...input, moves: ' Sy' });
    const restored = await runSegment({ ...input, moves: ' s' });
    const pet = restored.state.level?.monsters.find(monster => monster.m_id === restored.state.context.startingpet_mid);
    assert.ok(pet);
    assert.equal(canSpotMonster(pet), true, 'a visible restored pet must remain visible to search');
    assert.doesNotMatch(topline(), /unseen monster/);
});
void test('a rust trap announces water hitting a monster seen through infravision', async () => {
    const level = freshPlayableRoom({ hero: { infravision: true } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('minotaur', 15, 10, NO_MINVENT);
    for (let x = 8; x <= 18; x++)
        for (let y = 8; y <= 12; y++)
            level.requireAt(x, y).lit = false;
    vision_recalc(0);
    assert.equal(canSeeMonster(monster), true);
    const trap = addTrap(level, RUST_TRAP, 15, 10);
    const messages = [];
    const event = await beginMonsterRustTrap(monster, trap, game, { random: () => 0 });
    await finishMonsterRustTrap(monster, event, game, { publish: async (message) => { messages.push(message); } });
    assert.equal(trap.tseen, true);
    assert.equal(messages[0], 'A gush of water hits the minotaur on the head!');
});
for (const peaceful of [true, false]) {
    void test(`the ${peaceful ? 'peaceful' : 'angry'} Oracle greets a deaf hero once on entering Delphi`, async () => {
        const level = freshPlayableRoom({ role: 'samurai', hero: { deafTurns: 100 } });
        requirePlayingGame(game);
        game.plname = 'Listener';
        const room = createRoom({ lx: 8, hx: 18, ly: 8, hy: 12, rtype: DELPHI, rlit: 1 });
        level.rooms.push(room);
        for (let x = 8; x <= 18; x++)
            for (let y = 8; y <= 12; y++)
                level.requireAt(x, y).roomno = ROOMOFFSET;
        const oracle = await createMonsterAt('Oracle', 15, 10, NO_MINVENT);
        oracle.mpeaceful = peaceful;
        await checkSpecialRoom();
        await flush_screen();
        assert.equal(topline(), peaceful
            ? '"Konnichi wa, Listener, welcome to Delphi!"' : '"You\'re in Delphi, Listener."');
        assert.equal(room.rtype, OROOM);
    });
}
void test('a sandestin favors powerful forms when it changes again after birth', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('sandestin', 15, 10, NO_MINVENT);
    monster.cham = MONSTER_NAME.indexOf('sandestin');
    const powerful = [];
    for (let seed = 1n; seed <= 40n; seed++) {
        initRng(seed);
        await changeMonsterForm(monster, null, game);
        powerful.push((MONSTER_DIFFICULTY[monster.mnum] ?? 0) >= 10);
        assert.ok(level.monsters.includes(monster));
    }
    assert.ok(powerful.filter(Boolean).length > 20, 'sandestins usually select powerful monsters');
});
void test('a weakened vampire in fog form leaves a closed door before changing back', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    const vampire = MONSTER_NAME.indexOf('vampire');
    const monster = await createMonsterAt('fog cloud', 15, 10, NO_MINVENT);
    monster.cham = vampire;
    monster.mhp = 1;
    monster.mhpmax = 30;
    const door = level.requireAt(15, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    await decideMonsterShapeChange(monster, game, () => 1, { publish: async () => { } });
    assert.equal(monster.mnum, vampire);
    assert.notDeepEqual([monster.mx, monster.my], [15, 10]);
    assert.equal(door.doormask, D_CLOSED);
});
for (const deaf of [false, true]) {
    void test(`an unseen rolling boulder ${deaf ? 'is silent to a deaf hero' : 'rumbles and splashes'} before it reaches the trigger`, async () => {
        const level = freshPlayableRoom({ left: 2, right: 30, heroX: 2, hero: { deafTurns: deaf ? 100 : 0 }, flags: { verbose: true, acoustics: true } });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', 20, 10, NO_MINVENT);
        for (let x = 12; x <= 30; x++)
            for (let y = 8; y <= 12; y++)
                level.requireAt(x, y).lit = false;
        level.requireAt(19, 10).typ = LAVAPOOL;
        const trap = addTrap(level, ROLLING_BOULDER_TRAP, 20, 10, {
            launch: { x: 18, y: 10 }, launch2: { x: 24, y: 10 },
        });
        const boulder = await floorObject(BOULDER, 18, 10);
        vision_recalc(0);
        const hp = monster.mhp;
        const messages = [];
        const options = { random: (limit) => limit - 1, publish: async (message) => { messages.push(message); } };
        const action = await triggerImmediateMonsterTrap(monster, game, options);
        await finishImmediateMonsterTrap(action, game, options);
        assert.deepEqual(messages, deaf ? [] : ['You hear rumbling in the distance.', 'You hear a sizzling splash.']);
        assert.equal(monster.mhp, hp, 'the boulder sinks before it could hit the monster');
        assert.equal(boulder.where, 'gone');
        assert.equal(floorObjectsAt(level, 24, 10).includes(boulder), false);
        assert.equal(trap.tseen, false);
    });
}
for (const [offset, description] of [[4, 'nearby'], [5, 'in the distance']]) {
    void test(`an unseen boulder ${offset} squares away rumbles ${description} even without verbose prose`, async () => {
        const level = freshPlayableRoom({ left: 2, right: 30, heroX: 2, flags: { verbose: false, acoustics: true } });
        requirePlayingGame(game);
        for (let x = 4; x <= 30; x++)
            for (let y = 8; y <= 12; y++)
                level.requireAt(x, y).lit = false;
        const start = { x: game.u.ux + offset, y: 10 };
        await floorObject(BOULDER, start.x, start.y);
        vision_recalc(0);
        const messages = [];
        await launchRollingBoulder(start, { x: 25, y: 10 }, {
            state: game, unseen: true, publish: async (message) => { messages.push(message); },
        });
        assert.deepEqual(messages, [`You hear rumbling ${description}.`]);
    });
}
void test('a trap can launch one boulder from a stack at its opposite endpoint', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    const stack = await floorObject(BOULDER, 16, 10, { quan: 2 });
    const released = await launchRollingBoulder({ x: 12, y: 10 }, { x: 16, y: 10 }, { state: game });
    assert.equal(released, true);
    assert.equal(stack.quan, 1);
    assert.equal(floorObjectsAt(level, 16, 10).includes(stack), true);
    assert.equal(floorObjectsAt(level, 12, 10).filter(object => object.otyp === BOULDER).length, 1);
});
void test('disabled acoustics suppress both an unseen launch and its splash', async () => {
    const level = freshPlayableRoom({ left: 2, right: 30, heroX: 2, flags: { acoustics: false } });
    requirePlayingGame(game);
    for (let x = 12; x <= 30; x++)
        for (let y = 8; y <= 12; y++)
            level.requireAt(x, y).lit = false;
    level.requireAt(19, 10).typ = LAVAPOOL;
    const boulder = await floorObject(BOULDER, 18, 10);
    vision_recalc(0);
    const messages = [];
    await launchRollingBoulder({ x: 18, y: 10 }, { x: 24, y: 10 }, {
        state: game, unseen: true, random: limit => limit - 1,
        publish: async (message) => { messages.push(message); },
    });
    assert.deepEqual(messages, []);
    assert.equal(boulder.where, 'gone');
});
//# sourceMappingURL=hearing.test.js.map