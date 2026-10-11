import assert from 'node:assert/strict';
import test from 'node:test';
import {
    D_CLOSED, D_LOCKED, DOOR, IRONBARS, MM_ANGRY, NO_MINVENT, STONE,
    W_NONPASSWALL, W_NONDIGGABLE, W_WEP,
} from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { hurtleMonster } from '../js/monster_hurtle.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterHasKey } from '../js/monster_movement_traits.js';
import type { Monster } from '../js/monster_types.js';
import { mfndpos } from '../js/monmove.js';
import { CLOVE_OF_GARLIC, CREDIT_CARD, LOCK_PICK, PICK_AXE, SCR_SCARE_MONSTER, SKELETON_KEY } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function admits(monster: Monster, x = 11, y = 10): boolean {
    requirePlayingGame(game);
    return mfndpos(monster, game).some(square => square.x === x && square.y === y);
}

for (const [type, toolName] of [
    [SKELETON_KEY, 'skeleton key'], [LOCK_PICK, 'lock pick'], [CREDIT_CARD, 'credit card'],
] as const) {
    void test(`carrying a ${toolName} lets a humanoid select a locked door`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        assert.equal(admits(goblin), false);

        await addObjectToMonsterInventory(goblin, await knownObject(type));

        assert.equal(admits(goblin), true);
        assert.equal(monsterHasKey(goblin, false), type !== CREDIT_CARD);
    });
}

void test('a dog cannot operate a door even when carrying a real key', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    const dog = await createMonsterAt('dog', 10, 10, MM_ANGRY | NO_MINVENT);
    await addObjectToMonsterInventory(dog, await knownObject(SKELETON_KEY));
    const door = level.requireAt(11, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    assert.equal(admits(dog), false);

    door.doormask = D_LOCKED;
    assert.equal(admits(dog), false);
});

for (const species of ['hill giant', 'Death', 'Wizard of Yendor']) {
    void test(`${species} can select a locked door without a carried key`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;

        assert.equal(admits(monster), true);
    });
}

void test('a digging dwarf uses its remembered target distance and gives up digging under nearby Conflict', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    const dwarf = await createMonsterAt('dwarf', 10, 10, MM_ANGRY | NO_MINVENT);
    await equipMonsterObject(dwarf, await knownObject(PICK_AXE), W_WEP);
    level.requireAt(11, 10).typ = STONE;
    dwarf.mux = 15;
    dwarf.muy = 12;
    assert.equal(admits(dwarf), true);

    dwarf.mux = 12;
    dwarf.muy = 10;
    assert.equal(admits(dwarf), false);

    dwarf.mpeaceful = 1;
    assert.equal(admits(dwarf), true);

    grantIntrinsicProperty('conflict', 'outside');
    assert.equal(admits(dwarf), false);
});

void test('the Rogue level prevents a rock mole from selecting diggable rock', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    requirePlayingGame(game);
    const mole = await createMonsterAt('rock mole', 10, 10, MM_ANGRY | NO_MINVENT);
    level.requireAt(11, 10).typ = STONE;
    assert.equal(admits(mole), true);

    game.rogue_level = { ...game.u.uz };
    assert.equal(admits(mole), false);
});

void test('phasing admits ordinary stone while respecting a wall that forbids passage', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    const ghost = await createMonsterAt('ghost', 10, 10, MM_ANGRY | NO_MINVENT);
    const rock = level.requireAt(11, 10);
    rock.typ = STONE;
    assert.equal(admits(ghost), true);

    rock.wall_info = W_NONPASSWALL;
    assert.equal(admits(ghost), false);
});

void test('a carrier passes iron bars only when the held hero fits through them', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    const vortex = await createMonsterAt('fog cloud', 10, 10, MM_ANGRY | NO_MINVENT);
    level.requireAt(11, 10).typ = IRONBARS;
    assert.equal(admits(vortex), true);

    game.u.ustuck = vortex;
    assert.equal(admits(vortex), false);

    installPolymorphedHero('fog cloud');
    assert.equal(admits(vortex), true);

    installPolymorphedHero('kitten');
    assert.equal(admits(vortex), false);

    installPolymorphedHero('grid bug');
    assert.equal(admits(vortex), true);
});

void test('rusting bars cannot admit a corrosive monster when the level forbids destroying them', async () => {
    const level = freshObjectRoom({ heroX: 15, heroY: 12 });
    const rustMonster = await createMonsterAt('rust monster', 10, 10, MM_ANGRY | NO_MINVENT);
    const bars = level.requireAt(11, 10);
    bars.typ = IRONBARS;
    assert.equal(admits(rustMonster), true);

    bars.wall_info = W_NONDIGGABLE;
    assert.equal(admits(rustMonster), false);
});

for (const species of ['rust monster', 'goblin']) {
    void test(`hurtling ${species} uses its real ability to pass iron bars`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        level.requireAt(11, 10).typ = IRONBARS;

        const outcome = await hurtleMonster(monster, 1, 0, 1);

        assert.equal(outcome.moved, species === 'rust monster');
        assert.equal(monster.mx, species === 'rust monster' ? 11 : 10);
        assert.equal(level.requireAt(11, 10).typ, IRONBARS);
    });
}

for (const species of ['human zombie', 'ghost', 'vampire bat']) {
    void test(`${species} follows undead and vampire-origin garlic restrictions`, async () => {
        freshObjectRoom({ heroX: 15, heroY: 12 });
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        if (species === 'vampire bat') monster.cham = MONSTER_NAME.indexOf('vampire');
        await floorObject(CLOVE_OF_GARLIC, 11, 10);

        assert.equal(admits(monster), species === 'ghost');
    });
}

void test('a unicorn may use a square aligned with the hero when teleportation is forbidden', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    const unicorn = await createMonsterAt('white unicorn', 10, 10, MM_ANGRY | NO_MINVENT);
    unicorn.mux = 14;
    unicorn.muy = 10;
    assert.equal(admits(unicorn), false);

    level.flags.noteleport = true;
    assert.equal(admits(unicorn), true);
});

void test('a tame dog may cross scare-monster protection that a hostile goblin avoids', async () => {
    freshObjectRoom({ heroX: 15, heroY: 12 });
    const dog = await createMonsterAt('little dog', 10, 10, NO_MINVENT);
    initializePet(dog);
    const goblin = await createMonsterAt('goblin', 12, 10, MM_ANGRY | NO_MINVENT);
    await floorObject(SCR_SCARE_MONSTER, 11, 10);

    assert.equal(admits(dog), true);
    assert.equal(admits(goblin), false);
});
