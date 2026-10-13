import assert from 'node:assert/strict';
import test from 'node:test';
import { G_GENOD, MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { LUMP_OF_ROYAL_JELLY } from '../js/object_data.js';
import { beginPetEating, finishPetEating } from '../js/pet_eating.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectQuantityAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;

async function beeRoom() {
    const level = freshObjectRoom();
    const bee = await createMonsterAt('killer bee', 12, 10, BIRTH_FLAGS);
    bee.msleeping = 0;
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    return { level, bee };
}

for (const jelly of [
    { blessed: true, cursed: false, delay: 3 },
    { blessed: false, cursed: false, delay: 5 },
    { blessed: false, cursed: true, delay: 7 },
]) {
    void test(`a wild bee eats one royal jelly and becomes a queen with a ${jelly.delay}-turn delay`, async () => {
        const { level, bee } = await beeRoom();
        await floorObject(LUMP_OF_ROYAL_JELLY, 12, 10, {
            quan: 3, blessed: jelly.blessed, cursed: jelly.cursed,
        });
        requirePlayingGame(game);

        await takeMonsterTurn(bee, game);

        assert.equal(bee.mnum, QUEEN_BEE);
        assert.equal(floorObjectQuantityAt(level, 12, 10, LUMP_OF_ROYAL_JELLY), 2);
        assert.equal(bee.mfrozen, jelly.delay);
        assert.equal(bee.mcanmove, 0);
        assert.equal(bee.mx, 12);
        assert.equal(bee.my, 10);
    });
}

void test('a living queen prevents another wild bee from eating royal jelly', async () => {
    const { bee } = await beeRoom();
    await createMonsterAt('queen bee', 14, 10, BIRTH_FLAGS);
    const jelly = await floorObject(LUMP_OF_ROYAL_JELLY, 12, 10);
    requirePlayingGame(game);

    await takeMonsterTurn(bee, game);

    assert.equal(bee.mnum, MONSTER_NAME.indexOf('killer bee'));
    assert.equal(jelly.where, 'floor');
});

void test('eating royal jelly kills a bee when queen bees have been genocided', async () => {
    const { level, bee } = await beeRoom();
    const jelly = await floorObject(LUMP_OF_ROYAL_JELLY, 12, 10);
    requirePlayingGame(game);
    assert.ok(game.mvitals);
    game.mvitals[QUEEN_BEE] = { born: 0, died: 0, mvflags: G_GENOD };

    await takeMonsterTurn(bee, game);

    assert.equal(level.monsters.includes(bee), false);
    assert.equal(jelly.where, 'gone');
});

void test('a pet bee consumes only one royal jelly from its meal stack', async () => {
    const { level, bee } = await beeRoom();
    initializePet(bee);
    const jelly = await floorObject(LUMP_OF_ROYAL_JELLY, 12, 10, { quan: 3 });

    await finishPetEating(bee, beginPetEating(bee, jelly, { x: 12, y: 10 }));

    assert.equal(bee.mnum, QUEEN_BEE);
    assert.equal(floorObjectQuantityAt(level, 12, 10, LUMP_OF_ROYAL_JELLY), 2);
});
