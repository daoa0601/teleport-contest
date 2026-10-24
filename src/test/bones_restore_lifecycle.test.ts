import assert from 'node:assert/strict';
import test from 'node:test';

import { game, requireGameLevel } from '../js/gstate.js';
import { DOOR, D_NODOOR, HWALL, SHOP_WALL_COST } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { InMemoryStorage } from '../js/storage.js';
import { addShopDamage } from '../js/shop_damage.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
import { createStaffedShop } from './support/shop.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>, wizard = true): void {
    freshPlayableRoom({ flags: { debug: wizard }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}

void test('bones are abandoned if the storage backend cannot unlink them', async () => {
    const storage = new class extends InMemoryStorage {
        override removeItem(): void {}
    }();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    resetInputState().feed('yy');

    await mklev();

    assert.equal(!!game._restoredBones, false);
    assert.equal(storage.length, 1);
});

for (const wizard of [false, true]) {
    void test(`unusable bones are discarded${wizard ? ' after only the wizard unlink question' : ' with a reassuring message'}`, async () => {
        const storage = memoryStorage();
        bonesRoom(storage);
        assert.equal(saveBonesLevel(), true);
        const key = storage.key(0);
        assert.ok(key);
        storage.setItem(key, 'unusable bones');
        bonesRoom(storage, wizard);
        const prompts: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => {
            prompts.push(game._pending_message);
            input.feed('y');
        };
        initRng(3n);

        await mklev();

        assert.equal(storage.length, 0, 'unusable bones must not be offered again');
        assert.equal(!!game._restoredBones, false);
        assert.equal(game.u.uroleplay?.numbones, 1);
        if (wizard) {
            assert.equal(prompts.length, 1);
            assert.match(prompts[0] ?? '', /Unlink bones\?/);
        } else {
            assert.equal(prompts.length, 0);
            assert.match(game._pending_message, /Discarding unusable bones; no need to panic/);
        }
    });
}

void test('loading bones repairs an old shop wall breach before play resumes', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const { roomno } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
    const wall = requireGameLevel().requireAt(8, 10);
    wall.typ = HWALL;
    wall.roomno = roomno;
    wall.edge = true;
    addShopDamage(8, 10, SHOP_WALL_COST);
    wall.typ = DOOR;
    wall.doormask = D_NODOOR;
    game.moves += 5;
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    game.moves = 20;
    resetInputState().feed('yn');

    await mklev();

    assert.equal(requireGameLevel().requireAt(8, 10).typ, HWALL);
    assert.equal(requireGameLevel().damagelist?.length, 0);
});

void test('accepting bones counts the encounter while declining them leaves the count unchanged', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    for (const accept of [false, true]) {
        bonesRoom(storage);
        resetInputState().feed(accept ? 'yn' : 'n');

        await mklev();

        assert.equal(game.u.uroleplay?.numbones, accept ? 1 : 0);
    }
});

