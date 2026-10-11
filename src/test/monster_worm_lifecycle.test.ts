import { addTrap, floorObjectsAt } from './support/level-state.js';
import { assertWormBody } from './support/worms.js';
import type { Monster } from '../js/monster_types.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COLNO, DB_MOAT, DB_NORTH, DBWALL, DRAWBRIDGE_UP,
    MM_ANGRY, MM_NOTAIL, NO_MINVENT, ROOM, ROWNO, STONE, W_AMUL, TELEP_TRAP,
} from '../js/const.js';
import { reviveCorpseByMagic } from '../js/corpse_revival.js';
import { openDrawbridge } from '../js/dbridge.js';
import { initializePet } from '../js/dog.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { gotoLevel } from '../js/level_change.js';
import { createCorpstatAt, mklev, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { petrifyMonsterAttacker } from '../js/monster_stoning.js';
import { runMonsterAction } from '../js/monmove.js';
import { AMULET_OF_LIFE_SAVING, STATUE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { animateStatue } from '../js/statue_trap.js';
import { teleportMonsterFromTrap } from '../js/teleport.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function occupiedSquares(worm: Monster, level = requireGameLevel()) {
    const squares = [];
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            if (monsterAtPosition(level, x, y) === worm) squares.push({ x, y });
        }
    }
    return squares;
}

function acknowledgeWormMessages() {
    installPagerInput(resetInputState(), {
        expected: /worm|medallion|But wait|moves?|die|statue|goblin|turns?|bridge|corpse|looks much better|crumbles/i,
        limit: 24,
    });
}

async function growingWorm() {
    freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10,
        heroX: 8, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    acknowledgeWormMessages();
    initRng(1n);
    await runMonsterAction(worm, game);
    assert.equal(occupiedSquares(worm).length, 2);
    assertWormBody(worm);
    return worm;
}

void test('same-level teleport rebuilds the body without resetting growth or HP', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);
    const deadline = worm.wormGrowTime;
    const health = worm.mhp;

    const trap = addTrap(game.level, TELEP_TRAP, worm.mx, worm.my, { teledest: { x: 20, y: 10 } });
    await teleportMonsterFromTrap(worm, trap);

    assert.deepEqual([worm.mx, worm.my], [20, 10]);
    assert.equal(monsterAtPosition(game.level, 13, 10), null);
    assert.equal(monsterAtPosition(game.level, 14, 10), null);
    assert.notEqual(game.level.requireAt(13, 10).remembered_glyph?.kind, 'monster');
    assert.notEqual(game.level.requireAt(14, 10).remembered_glyph?.kind, 'monster');
    assert.equal(occupiedSquares(worm).length, 2);
    assert.equal(worm.wormGrowTime, deadline);
    assert.equal(worm.mhp, health);
    await runMonsterAction(worm, game);
    assert.equal(occupiedSquares(worm).length, 2);
    assert.equal(worm.mhp, health);
});

void test('save and restore preserve the worm body and next growth deadline', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);
    const squares = occupiedSquares(worm);
    const deadline = worm.wormGrowTime;
    const health = worm.mhp;
    const storage = memoryStorage();
    game.plname = 'Grower';
    assert.equal(await saveGame(storage), true);
    await runMonsterAction(worm, game);
    const translated = occupiedSquares(worm);

    assert.equal(restoreGame('Grower', storage), true);
    const restored = game.level.monsters.find(monster => monster.m_id === worm.m_id);
    assert.ok(restored);

    assert.deepEqual(occupiedSquares(restored), squares);
    assert.equal(restored.wormGrowTime, deadline);
    assert.equal(restored.mhp, health);
    await runMonsterAction(restored, game);
    assert.deepEqual(occupiedSquares(restored), translated);
    assert.equal(restored.mhp, health);
    game.moves = deadline;
    await runMonsterAction(restored, game);
    assert.equal(occupiedSquares(restored).length, 3);
});

for (const newMoves of [1, 1000]) {
    void test(`bones preserve the old game's literal growth deadline at move ${newMoves}`, async () => {
        const storage = memoryStorage();
        const worm = await growingWorm();
        requirePlayingGame(game);
        game.u.uz = { dnum: 0, dlevel: 7 };
        game.storage = storage;
        game.flags.debug = true;
        const deadline = worm.wormGrowTime;
        const squares = occupiedSquares(worm);
        assert.equal(saveBonesLevel(), true);
        freshObjectRoom({ left: 8, right: 22, top: 10, bottom: 10,
            heroX: 8, heroY: 10, moves: newMoves,
            hero: { uz: { dnum: 0, dlevel: 7 } } });
        requirePlayingGame(game);
        game.storage = storage;
        game.flags.debug = true;
        const input = resetInputState();
        await answerPrompts(mklev(), input, [
            { prompt: /Get bones\?/, keys: 'y' },
            { prompt: /Unlink bones\?/, keys: 'n' },
        ]);
        acknowledgeWormMessages();
        const restored = game.level.monsters.find(monster => monster.mnum === worm.mnum);

        assert.ok(restored, 'the bones retained the worm');
        assert.deepEqual(occupiedSquares(restored), squares);
        assert.equal(restored.wormGrowTime, deadline);
        await runMonsterAction(restored, game);
        assert.equal(occupiedSquares(restored).length, newMoves < deadline ? 2 : 3);
    });
}

for (const kind of ['permanent death', 'departure', 'life saving']) {
    void test(`${kind} ${kind === 'life saving' ? 'preserves' : 'clears'} the worm body`, async () => {
        const worm = await growingWorm();
        requirePlayingGame(game);
        const squares = occupiedSquares(worm);
        const deadline = worm.wormGrowTime;
        if (kind === 'life saving')
            await equipMonsterObject(worm, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);

        if (kind === 'departure') await removeMonsterFromGame(worm);
        else {
            worm.mhp = 0;
            await finishEnvironmentalMonsterDeath(worm, game);
        }

        if (kind === 'life saving') {
            assert.ok(worm.mhp > 0);
            assert.deepEqual(occupiedSquares(worm), squares);
            assert.equal(worm.wormGrowTime, deadline);
        } else {
            assert.equal(occupiedSquares(worm).length, 0);
            assert.notEqual(game.level.requireAt(14, 10).remembered_glyph?.kind, 'monster');
        }
    });
}

void test('polymorph discards the old body and deadline', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);

    await changeMonsterForm(worm, MONSTER_NAME.indexOf('goblin'));

    assert.equal(monsterAtPosition(game.level, 14, 10), null);
    assert.equal(occupiedSquares(worm).length, 1);
    assert.equal(worm.wormGrowTime, 0);
    await changeMonsterForm(worm, MONSTER_NAME.indexOf('long worm'));
    assert.equal(worm.wormGrowTime, 0);
});

for (const grow of [false, true]) {
    void test(`migration rebuilds a ${grow ? 'tailed' : 'head-only'} worm with new growth timing`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        const worm = await createMonsterAt('long worm', 14, 10,
            MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        acknowledgeWormMessages();
        initRng(1n);
        if (grow) await runMonsterAction(worm, game);
        const count = occupiedSquares(worm).length;
        const storage = memoryStorage();
        game.plname = 'MigrantWorm';

        await migrateMonsterOffLevel(worm, game, { dst: { dnum: 0, dlevel: 2 } });
        assert.equal(occupiedSquares(worm, source).length, 0);
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('MigrantWorm', storage), true);
        await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
        const arrived = game.level.monsters.find(monster => monster.m_id === worm.m_id);

        assert.ok(arrived);
        assert.equal(occupiedSquares(arrived).length, count);
        assert.equal(arrived.wormGrowTime, 0);
    });
}


void test('a relocation that truncates every segment does not restart growth', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);
    const deadline = worm.wormGrowTime;
    const health = worm.mhp;
    game.level.requireAt(19, 10).typ = STONE;
    game.level.requireAt(21, 10).typ = STONE;

    const trap = addTrap(game.level, TELEP_TRAP, worm.mx, worm.my, { teledest: { x: 20, y: 10 } });
    await teleportMonsterFromTrap(worm, trap);

    assert.equal(occupiedSquares(worm).length, 1);
    assert.equal(worm.wormGrowTime, deadline);
    game.level.requireAt(19, 10).typ = ROOM;
    await runMonsterAction(worm, game);
    assert.equal(worm.mx, 19);
    assert.equal(occupiedSquares(worm).length, 1);
    assert.equal(worm.mhp, health);
    assert.equal(worm.wormGrowTime, deadline);
});


void test('a revived pet worm receives a new head-only body and grows from its revival square', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);
    initializePet(worm, { state: game });
    const health = worm.mhpmax;
    worm.mhp = 0;
    const death = await finishEnvironmentalMonsterDeath(worm, game);
    assert.ok(death.corpse);

    const revival = await reviveCorpseByMagic(death.corpse, game);

    assert.ok(revival?.kind === 'revived', 'Magic revives the dead pet');
    const revived = revival.monster;
    assertWormBody(revived);
    assert.ok(revived.mhpmax >= health);
    assert.equal(revived.mhp, revived.mhpmax);
    assert.equal(occupiedSquares(revived).length, 1);
    assert.equal(revived.wormGrowTime, 0);
    const head = { x: revived.mx, y: revived.my };
    await runMonsterAction(revived, game);
    assert.notDeepEqual({ x: revived.mx, y: revived.my }, head);
    assert.equal(monsterAtPosition(game.level, head.x, head.y), revived);
    assert.equal(occupiedSquares(revived).length, 2);
    assert.ok(revived.wormGrowTime > game.moves);
});

for (const restoration of ['none', 'save', 'revisit']) {
    const restored = restoration !== 'none';
    void test(`an opening drawbridge leaves the hidden worm head ${restored ? `normalized by ${restoration}` : 'behind until its next move'}`, async () => {
        if (restoration === 'revisit') {
            freshConnectedLevels();
            game.flags.verbose = false;
        } else {
            freshObjectRoom({ left: 8, right: 22, top: 6, bottom: 14,
                heroX: 18, heroY: 12 });
        }
        requirePlayingGame(game);
        for (let x = 11; x <= 13; x++) {
            for (let y = 8; y <= 10; y++) game.level.requireAt(x, y).typ = STONE;
        }
        game.level.requireAt(12, 9).typ = DBWALL;
        const location = game.level.requireAt(12, 10);
        location.typ = DRAWBRIDGE_UP;
        location.drawbridgemask = DB_NORTH | DB_MOAT;
        const elemental = await createMonsterAt('earth elemental', 12, 9,
            MM_ANGRY | NO_MINVENT);
        acknowledgeWormMessages();
        await changeMonsterForm(elemental, MONSTER_NAME.indexOf('long worm'));
        assert.equal(occupiedSquares(elemental).length, 1);
        assert.equal(await openDrawbridge(12, 10), true);
        assert.deepEqual([elemental.mx, elemental.my], [12, 10]);
        let worm: Monster = elemental;
        if (restoration === 'save') {
            const storage = memoryStorage();
            game.plname = 'BridgeWorm';
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame('BridgeWorm', storage), true);
            const restored = game.level.monsters.find(monster => monster.m_id === elemental.m_id);
            assert.ok(restored, 'The saved worm is restored');
            worm = restored;
        } else if (restoration === 'revisit') {
            await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
            await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        }

        await runMonsterAction(worm, game);

        assert.notDeepEqual([worm.mx, worm.my], [12, 10]);
        assert.equal(occupiedSquares(worm).length, 2);
        assert.equal(monsterAtPosition(game.level, 12, restored ? 10 : 9), worm);
        assert.equal(monsterAtPosition(game.level, 12, restored ? 9 : 10), null);
    });
}


void test('a slotless worm stays head-only after another worm releases its body slot', async () => {
    freshObjectRoom({ left: 2, right: 76, top: 2, bottom: 18,
        heroX: 2, heroY: 2 });
    requirePlayingGame(game);
    const worms = [];
    for (let index = 0; index < 32; index++)
        worms.push(await createMonsterAt('long worm', 4 + index * 2, 10,
            MM_ANGRY | MM_NOTAIL | NO_MINVENT));
    acknowledgeWormMessages();
    const first = worms[0];
    const slotless = worms.at(-1);
    assert.ok(first && slotless, 'All requested worms were created');
    const health = slotless.mhp;

    await runMonsterAction(first, game);
    await runMonsterAction(slotless, game);

    assert.equal(occupiedSquares(first).length, 2);
    assert.equal(occupiedSquares(slotless).length, 1);
    assert.equal(slotless.mhp, health);
    await removeMonsterFromGame(first);
    await runMonsterAction(slotless, game);
    assert.equal(occupiedSquares(slotless).length, 1);
    assert.equal(slotless.mhp, health);
    const replacement = await createMonsterAt('long worm', 70, 10,
        MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    await runMonsterAction(replacement, game);
    assert.equal(monsterAtPosition(game.level, 70, 10), replacement);
    assert.equal(occupiedSquares(replacement).length, 2);
});

for (const body of ['corpse', 'statue']) {
    void test(`magic revives a ${body} beneath a worm tail on another square`, async () => {
        const worm = await growingWorm();
        requirePlayingGame(game);
        const squares = occupiedSquares(worm);
        const troll = MONSTER_NAME.indexOf('troll');
        const object = body === 'corpse'
            ? placeCreatedObject(await untimedCorpse(troll), 14, 10)
            : await createCorpstatAt(STATUE, null, troll, 14, 10, 0);

        const result = body === 'corpse'
            ? await reviveCorpseByMagic(object, game)
            : await animateStatue(object, 14, 10, { magic: true });

        assert.ok(result?.monster, 'the worm tail forces nearby placement, not revival failure');
        assert.equal(result.monster.mnum, troll);
        assert.notDeepEqual([result.monster.mx, result.monster.my], [14, 10]);
        assert.equal(monsterAtPosition(game.level, 14, 10), worm);
        assert.deepEqual(occupiedSquares(worm), squares);
        assert.equal(object.where, 'gone');
    });
}

void test('a petrified pet worm returns with a fresh identity and head-only body', async () => {
    const worm = await growingWorm();
    requirePlayingGame(game);
    initializePet(worm, { state: game });
    const head = { x: worm.mx, y: worm.my };
    await petrifyMonsterAttacker(worm, {
        finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, game, options),
    });
    const statue = floorObjectsAt(game.level, head.x, head.y).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(occupiedSquares(worm).length, 0);

    const { monster: restored } = await animateStatue(statue, head.x, head.y, { magic: true });

    assert.ok(restored);
    assert.notEqual(restored.m_id, worm.m_id);
    assert.equal(occupiedSquares(restored).length, 1);
    assert.equal(restored.wormGrowTime, 0);
    await runMonsterAction(restored, game);
    assert.equal(monsterAtPosition(game.level, head.x, head.y), restored);
    assert.equal(occupiedSquares(restored).length, 2);
});
