import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_NODOOR, HWALL, PIT, SHOP_WALL_COST, STAIRS } from '../js/const.js';
import { addFruit } from '../js/fruit.js';
import { readObjectName } from '../js/objnam.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addShopDamage, shopkeeperRepairsDamage } from '../js/shop_damage.js';
import { hasShopkeeperData } from '../js/shop_types.js';
import { initRng } from '../js/rng.js';
import { detectTraps } from '../js/trap_detection.js';
import { vision_recalc } from '../js/vision.js';
import { createStaffedShop } from './support/shop.js';
import { installPagerInput } from './support/pager-input.js';
import { gotoLevel } from '../js/level_change.js';
import { maketrap, u_on_upstairs } from '../js/mklev.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshConnectedLevels } from './support/connected-levels.js';

for (const cached of [false, true]) {
    void test(`${cached ? 'revisiting' : 'restoring'} a level rebuilds stair selection from the saved chain`, async () => {
        if (cached) freshConnectedLevels();
        else freshObjectRoom();
        requirePlayingGame(game);
        game.flags.verbose = false;
        for (const x of [11, 14]) requireGameLevel().requireAt(x, 10).typ = STAIRS;
        game.stairs = {
            sx: 14, sy: 10, up: true, isladder: false, u_traversed: false,
            tolev: { dnum: 0, dlevel: 1 }, next: {
                sx: 11, sy: 10, up: true, isladder: false, u_traversed: false,
                tolev: { dnum: 0, dlevel: 1 }, next: null,
            },
        };
        if (cached) {
            await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
            await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        } else {
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
        }

        await u_on_upstairs();

        assert.equal(game.u.ux, 11, 'Restoring prepends each saved stair, selecting the older upstairs first');
        assert.equal(game.u.uy, 10);
    });
}

void test('restoring lets the shopkeeper repair the older saved breach first', async () => {
    freshObjectRoom();
    const { roomno, shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    for (const y of [9, 11]) {
        const wall = requireGameLevel().requireAt(8, y);
        wall.typ = HWALL;
        wall.roomno = roomno;
        wall.edge = true;
        addShopDamage(8, y, SHOP_WALL_COST);
        wall.typ = DOOR;
        wall.doormask = D_NODOOR;
    }
    game.moves += 5;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    vision_recalc(0);
    const keeper = requireGameLevel().monsters.find(monster => monster.m_id === shopkeeper.m_id);
    assert.ok(keeper && hasShopkeeperData(keeper));
    const input = resetInputState();
    installPagerInput(input, { expected: /incantation|wall closes/, limit: 3 });

    await shopkeeperRepairsDamage(keeper);

    assert.equal(requireGameLevel().requireAt(8, 9).typ, HWALL, 'The older breach is repaired');
    assert.equal(requireGameLevel().requireAt(8, 11).typ, DOOR, 'One repair leaves the newer breach open');
});

void test('hallucinating trap detection visits the older restored trap before newer traps', async () => {
    freshObjectRoom({ flags: { tips: false }, hero: { hallucinationTurns: 20 } });
    requireGameLevel().requireAt(30, 10).typ = DOOR;
    await maketrap(30, 10, PIT);
    initRng(123n);
    resetInputState().feed('.');
    await detectTraps(null);
    const single = requireGameLevel().requireAt(30, 10).remembered_glyph;
    assert.ok(single?.kind === 'object');

    freshObjectRoom({ flags: { tips: false }, hero: { hallucinationTurns: 20 } });
    requireGameLevel().requireAt(30, 10).typ = DOOR;
    requireGameLevel().requireAt(32, 10).typ = DOOR;
    await maketrap(30, 10, PIT);
    await maketrap(32, 10, PIT);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    initRng(123n);
    resetInputState().feed('.');

    await detectTraps(null);

    const older = requireGameLevel().requireAt(30, 10).remembered_glyph;
    assert.ok(older?.kind === 'object');
    assert.equal(older.otyp, single.otyp, 'The older restored trap gets the first imaginary object');
});

void test('restoring rebuilds the fruit registry before resolving ambiguous fruit wishes', async () => {
    freshObjectRoom();
    const pluralFruit = addFruit('guavas');
    addFruit('guava');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);

    const wished = await readObjectName('guavas', { wizardWish: true });

    assert.ok(wished && !wished.noWish);
    assert.equal(wished.object.spe, pluralFruit, 'The restored older exact fruit name precedes the newer plural match');
    assert.equal(wished.object.quan, 1);
});
