import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR, ALTAR, CORR, FOUNTAIN, IRONBARS, LA_UP, ROOM, SCORR,
    SINK, S_LPUDDING, S_LRING, STAIRS, THRONE, TREE, TREE_LOOTED, TREE_SWARM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE, IRON_SHOES } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

void test('a kick can expose a secret corridor', async () => {
    const level = freshPlayableRoom();
    requirePlayingGame(game);
    for (const attribute of [A_STR, A_DEX, A_CON]) game.u.acurr.a[attribute] = 25;
    const passage = level.requireAt(11, 10);
    passage.typ = SCORR;

    await kickDirection('l', ' '.repeat(5));

    assert.equal(passage.typ, CORR);
    assert.equal(game._pending_message, 'Crash!  You kick open a secret passage!');
    assert.equal(game.context.move, 1);
});

void test('kicking an altar brings its deity wrath', async () => {
    const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    level.requireAt(11, 10).typ = ALTAR;
    level.requireAt(11, 10).flags = 1;
    const luck = game.u.uluck ?? 0;

    await kickDirection('l', ' '.repeat(20));

    assert.ok((game.u.uluck ?? 0) < luck || game.u.ualign.record < 10);
});

void test('kicking a fountain can rust metal boots', async () => {
    let rusted = false;
    for (let seed = 1n; seed <= 30n && !rusted; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100, uluck: 0 } });
        level.requireAt(11, 10).typ = FOUNTAIN;
        const boots = await addInventoryObject(IRON_SHOES, { initialize: false });
        game.uarmf = boots;

        await kickDirection('l', ' '.repeat(10));

        rusted = (boots.oeroded ?? 0) > 0;
        if (rusted) assert.equal(level.requireAt(11, 10).typ, FOUNTAIN);
    }
    assert.ok(rusted, 'Fountain spray can rust iron footwear.');
});

void test('a looted throne can break into a pile of gold', async () => {
    let destroyed = false;
    for (let seed = 1n; seed <= 30n && !destroyed; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const throne = level.requireAt(11, 10);
        throne.typ = THRONE;
        throne.looted = 1;
        game.dungeons = [createDungeon({ dname: 'Doom', num_dunlevs: 1 })];

        await kickDirection('l', ' '.repeat(10));

        if (throne.typ === ROOM) {
            destroyed = true;
            assert.equal(throne.looted, 0);
            const gold = level.objects[11]?.[10]?.find(object => object.otyp === GOLD_PIECE);
            assert.ok(gold && gold.quan >= 1 && gold.quan <= 200);
        }
    }
    assert.ok(destroyed, 'A kick can destroy a looted throne.');
});

void test('a sink kick can summon a black pudding once', async () => {
    let summoned = false;
    for (let seed = 1n; seed <= 50n && !summoned; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const sink = level.requireAt(11, 10);
        sink.typ = SINK;

        await kickDirection('l', ' '.repeat(10));

        if ((sink.looted ?? 0) & S_LPUDDING) {
            summoned = true;
            assert.ok(level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('black pudding')));
        }
    }
    assert.ok(summoned, 'A sink can disgorge a black pudding.');
});

void test('a backed-up sink leaves its ring at the kicked sink', async () => {
    let found = false;
    for (let seed = 1n; seed <= 50n && !found; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const sink = level.requireAt(11, 10);
        sink.typ = SINK;
        sink.looted = 3;

        await kickDirection('l', ' '.repeat(10));

        if ((sink.looted ?? 0) & S_LRING) {
            found = true;
            assert.ok(level.objects[11]?.[10]?.some(object => object.oclass === 4));
            assert.ok(!level.objects[10]?.[10]?.length);
        }
    }
    assert.ok(found, 'A backed-up sink can reveal a ring.');
});

void test('a tree can yield fruit once and then release its bees', async () => {
    let fruited = false, swarmed = false;
    for (let seed = 1n; seed <= 50n && (!fruited || !swarmed); seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        const tree = level.requireAt(11, 10);
        tree.typ = TREE;
        if (fruited) tree.looted = TREE_LOOTED;

        await kickDirection('l', ' '.repeat(20));

        if ((tree.looted ?? 0) & TREE_SWARM) {
            swarmed = true;
            assert.ok(level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('killer bee')));
        } else if (!fruited && ((tree.looted ?? 0) & TREE_LOOTED)) {
            fruited = true;
            assert.ok(floorObjects(level).some(object => object.oclass === 7));
        }
    }
    assert.ok(fruited && swarmed, 'A tree supplies fruit and its former occupants.');
});

void test('a surviving peaceful monster hit by kicked tree fruit becomes hostile', async () => {
    let hit = false;
    for (let seed = 1n; seed <= 50n && !hit; seed++) {
        const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
        level.requireAt(11, 10).typ = TREE;
        const hobbit = await createMonsterAt('hobbit', 12, 10);
        hobbit.mpeaceful = 1;
        hobbit.mhp = hobbit.mhpmax = 100;
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };

        await kickDirection('l', ' '.repeat(20));

        messages.push(game._pending_message);
        if (messages.some(message => /hits the hobbit\./.test(message))) {
            hit = true;
            assert.ok(hobbit.mhp > 0, 'The fruit target survives the impact.');
            assert.equal(hobbit.mpeaceful, 0, 'A fruit hit during the hero\'s kick angers its target.');
            assert.equal(game.context.move, 1);
        }
    }
    assert.ok(hit, 'Kicked tree fruit can hit a neighboring monster.');
});

for (const terrain of [IRONBARS, STAIRS]) {
    void test(`kicking hard terrain ${terrain} hurts`, async () => {
        const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = terrain;
        level.requireAt(11, 10).ladder = LA_UP;

        await kickDirection('l', ' '.repeat(10));

        assert.ok(game.u.uhp < 100);
        assert.equal(game._lastPlineMessage, 'Ouch!  That hurts!');
    });
}
