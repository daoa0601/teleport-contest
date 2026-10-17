import { monsterAtPosition } from '../js/monster_location.js';
import type { GameState } from '../js/game_state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, PIT, TT_PIT, W_AMUL } from '../js/const.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { applyFloorEffects } from '../js/floor_effects.js';
import { game, requireGameLevel, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, DAGGER } from '../js/object_data.js';
import { fillPitWithBoulderAt } from '../js/pit_fill.js';
import { polymonHero } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

function pitRoom(context: Partial<GameState['context']> = {}) {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 }, context,
        flags: { verbose: true }, gameplaySeed: 9n });
    requirePlayingGame(game);
    const input = resetInputState();
    let reads = 0;
    input.beforeRead = () => {
        if (++reads > 100) throw new Error(`Unexpected settling input: ${game._pending_message}`);
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /--More--|\(end\)/, `unexpected settling prompt: ${text}`);
        input.feed(' ');
    };
}

async function trappedMonster(species: string, hitPoints = 100) {
    const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = hitPoints;
    monster.mtrapped = 1;
    return monster;
}

void test('a settling boulder fills a pit through real deletion and buries the remaining pile', async () => {
    pitRoom();
    requirePlayingGame(game);
    const pit = addTrap(requireGameLevel(), PIT, 11, 10);
    const dagger = await floorObject(DAGGER, 11, 10);
    const boulder = await floorObject(BOULDER, 11, 10);

    const result = await fillPitWithBoulderAt(11, 10);

    assert.equal(result.filled, true);
    assert.ok(!requireGameLevel().traps.includes(pit));
    assert.equal(boulder.where, 'gone');
    assert.equal(dagger.where, 'buried');
});

void test('a boulder damages and releases a hero trapped beneath it', async () => {
    pitRoom();
    requirePlayingGame(game);
    addTrap(requireGameLevel(), PIT, 10, 10);
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    const boulder = await floorObject(BOULDER, 10, 10);

    await fillPitWithBoulderAt(10, 10);

    assert.ok(game.u.uhp < 200);
    assert.equal(game.u.utrap, 0);
    assert.equal(boulder.where, 'gone');
});

void test('hero life saving resumes the settling boulder cleanup', async () => {
    pitRoom();
    requirePlayingGame(game);
    addTrap(requireGameLevel(), PIT, 10, 10);
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
    game.u.uhp = 1;
    const boulder = await floorObject(BOULDER, 10, 10);

    const result = await fillPitWithBoulderAt(10, 10);

    assert.equal(result.heroDied, false);
    assert.equal(game.u.umortality, 1);
    assert.equal(game.u.utrap, 0);
    assert.equal(boulder.where, 'gone');
    assert.equal(requireGameLevel().traps.length, 0);
});

void test('a rock-throwing hero form is released without being crushed', async () => {
    pitRoom();
    requirePlayingGame(game);
    await polymonHero(MONSTER_NAME.indexOf('hill giant'));
    const before = game.u.mh;
    addTrap(requireGameLevel(), PIT, 10, 10);
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    await floorObject(BOULDER, 10, 10);

    await fillPitWithBoulderAt(10, 10);

    assert.equal(game.u.mh, before);
    assert.equal(game.u.utrap, 0);
});

for (const moving of [false, true]) {
    void test(`a ${moving ? 'monster' : 'hero'} turn settling boulder damages a trapped monster and frees it`, async () => {
        pitRoom({ mon_moving: moving });
        requirePlayingGame(game);
        const monster = await trappedMonster('jackal');
        addTrap(requireGameLevel(), PIT, 11, 10);
        await floorObject(BOULDER, 11, 10);

        await fillPitWithBoulderAt(11, 10);

        assert.ok(monster.mhp < 100);
        assert.equal(monster.mtrapped, 0);
        assert.equal(requireGameLevel().traps.length, 0);
    });
}

for (const species of ['hill giant', 'xorn']) {
    void test(`${species} is freed from a filled pit without boulder damage`, async () => {
        pitRoom();
        requirePlayingGame(game);
        const monster = await trappedMonster(species);
        addTrap(requireGameLevel(), PIT, 11, 10);
        await floorObject(BOULDER, 11, 10);

        await fillPitWithBoulderAt(11, 10);

        assert.equal(monster.mhp, 100);
        assert.equal(monster.mtrapped, 0);
    });
}

for (const moving of [false, true]) {
    void test(`a fatal boulder on a ${moving ? 'monster' : 'hero'} turn assigns its actual kill credit`, async () => {
        pitRoom({ mon_moving: moving });
        requirePlayingGame(game);
        const monster = await trappedMonster('jackal', 1);
        addTrap(requireGameLevel(), PIT, 11, 10);
        const boulder = await floorObject(BOULDER, 11, 10);
        initRng(9n);

        await fillPitWithBoulderAt(11, 10);

        assert.notEqual(monsterAtPosition(requireGameLevel(), monster.mx, monster.my), monster);
        assert.equal(game.u.uconduct.killer || 0, moving ? 0 : 1);
        assert.equal(boulder.where, 'gone');
        assert.equal(requireGameLevel().traps.length, 0);
    });
}

void test('a life-saved trapped monster survives while the boulder still fills its pit', async () => {
    pitRoom({ mon_moving: true });
    requirePlayingGame(game);
    const monster = await trappedMonster('jackal', 1);
    const amulet = await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
    addTrap(requireGameLevel(), PIT, 11, 10);
    const boulder = await floorObject(BOULDER, 11, 10);

    await fillPitWithBoulderAt(11, 10);

    assert.ok(requireGameLevel().monsters.includes(monster));
    assert.ok(monster.mhp > 0);
    assert.equal(monster.mtrapped, 0);
    assert.equal(amulet.where, 'gone');
    assert.equal(boulder.where, 'gone');
});

void test('shop-owned boulders remain represented by used-up bills after filling a pit', async () => {
    pitRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    addTrap(requireGameLevel(), PIT, 11, 10);
    const boulder = await floorObject(BOULDER, 11, 10);

    await fillPitWithBoulderAt(11, 10);

    assert.ok(shopkeeper.eshk.bill.some(entry => entry.bo_id === boulder.o_id && entry.useup));
    assert.ok(!(requireGameLevel().objects[11]?.[10] || []).includes(boulder));
});

void test('a free boulder landing in a pit uses the same occupant damage and cleanup', async () => {
    pitRoom();
    requirePlayingGame(game);
    const monster = await trappedMonster('jackal');
    addTrap(requireGameLevel(), PIT, 11, 10);
    const boulder = await knownObject(BOULDER);

    const result = await applyFloorEffects(boulder, 11, 10, { verb: 'fall' });

    assert.equal(result.finished, true);
    assert.ok(monster.mhp < 100);
    assert.equal(monster.mtrapped, 0);
    assert.equal(boulder.where, 'gone');
});
