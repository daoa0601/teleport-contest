import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { STAIRS } from '../js/const.js';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { checkSpecialRoom, shopkeeperForHero } from '../js/shk.js';
import { restoreGame, saveGame } from '../js/save.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';

async function enterAt(x: number, y: number) {
    requirePlayingGame(game);
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    game.u.ux = x;
    game.u.uy = y;
    pushKeys('          ');
    await checkSpecialRoom();
}

void test('checking the same shop twice does not greet the hero twice', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    await enterAt(10, 10);

    await checkSpecialRoom();

    assert.equal(shopkeeper.eshk.visitct, 1);
});

void test('restoring inside a shop preserves the completed entry', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    const id = shopkeeper.m_id;
    game.plname = 'RoomSaver';
    await enterAt(10, 10);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('RoomSaver', storage), true);

    await checkSpecialRoom();

    const restored = game.level.monsters.find(monster => monster.m_id === id);
    assert.ok(restored != null);
    assert.ok(restored.eshk != null, 'Expected restored.eshk to be initialized');
    assert.equal(restored.eshk.visitct, 1);
});

void test('a deserted shop reports its vacancy and does not repeat it on re-entry', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    await removeMonsterFromGame(shopkeeper);

    await enterAt(10, 10);

    assert.equal(game._lastPlineMessage, 'This shop is deserted.');
    await enterAt(4, 10);
    await pline('Outside the shop.');
    await enterAt(10, 10);
    assert.equal(game._lastPlineMessage, 'Outside the shop.');
});

void test('a blind hero without detection cannot be sure an empty shop is deserted', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    await removeMonsterFromGame(shopkeeper);
    setHeroBlindnessTurns(10);

    await enterAt(10, 10);

    assert.equal(game._lastPlineMessage, 'This shop seems to be untended.');
});

void test('shop vacancy memory is not carried through saving and restarting', async () => {
    freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 12 });
    await removeMonsterFromGame(shopkeeper);
    await enterAt(10, 10);
    game.plname = 'Vacancy';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    requirePlayingGame(game);
    assert.equal(restoreGame('Vacancy', storage), true);
    await enterAt(4, 10);

    await enterAt(10, 10);

    assert.equal(game._lastPlineMessage, 'This shop is deserted.');
});

void test('shops with the same room number on different levels each greet an arriving hero', async () => {
    freshConnectedLevels();
    const home = await createStaffedShop({ keeperX: 13 });
    assert.ok(game.level != null, 'Expected game.level to be initialized');
    game.level.requireAt(10, 10).typ = STAIRS;
    await enterAt(10, 10);
    pushKeys('                    ');
    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    const other = await createStaffedShop({ keeperX: 13 });
    game.level.requireAt(12, 10).typ = STAIRS;
    await checkSpecialRoom();
    assert.equal(other.roomno, home.roomno);
    assert.equal(other.shopkeeper.eshk.visitct, 1);

    pushKeys('                    ');
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });

    assert.equal(home.shopkeeper.eshk.visitct, 2);
});

for (const restore of [false, true]) {
    void test(`a keeper returning to an occupied shop resumes serving the hero${restore ? ' after restore' : ''}`, async () => {
        freshObjectRoom({ left: 3, hero: { ux: 4, uy: 10 } });
        requirePlayingGame(game);
        const { shopkeeper } = await createStaffedShop({ keeperX: 9 });
        const id = shopkeeper.m_id;
        shopkeeper.mx = 7;
        await enterAt(10, 10);
        assert.equal(shopkeeperForHero(), null);
        if (restore) {
            game.plname = 'AbsentKeeper';
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            freshObjectRoom();
            requirePlayingGame(game);
            assert.equal(restoreGame('AbsentKeeper', storage), true);
        }
        const returningKeeper = game.level.monsters.find(monster => monster.m_id === id);
        assert.ok(returningKeeper);
        pushKeys('                    ');

        await takeMonsterTurn(returningKeeper, game);

        assert.equal(shopkeeperForHero(), returningKeeper);
        assert.ok(returningKeeper != null);
        assert.ok(returningKeeper.eshk != null, 'Expected returningKeeper.eshk to be initialized');
        assert.equal(returningKeeper.eshk.visitct, 1);
    });
}
