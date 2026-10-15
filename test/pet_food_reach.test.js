import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, MM_NOGRP, MM_NOWAIT, NO_MINVENT, ROWNO, STONE, W_NONDIGGABLE, W_NONPASSWALL } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove } from '../js/monmove.js';
import { DAGGER } from '../js/object_data.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function foodRoom() {
    const level = freshObjectRoom({ left: 11, right: 16, top: 10, bottom: 10, heroX: 16 });
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const cell = level.requireAt(x, y);
            if (cell.typ === STONE)
                cell.wall_info = W_NONDIGGABLE | W_NONPASSWALL;
        }
    }
    level.requireAt(13, 10).typ = STONE;
    vision_recalc(0);
    return level;
}
for (const species of ['rock mole', 'xorn']) {
    void test(`a pet ${species} seeks preferred food through rock it can cross`, async () => {
        foodRoom();
        requirePlayingGame(game);
        const pet = await createMonsterAt(species, 14, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        initializePet(pet);
        assert.ok(pet.edog);
        pet.edog.whistletime = game.moves;
        await floorObject(DAGGER, 12, 10);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1));
        assert.equal(pet.mx, 13, 'preferred food attracts the pet across the rock');
        assert.equal(pet.my, 10);
    });
}
void test('a tunnelling pet ignores food behind undiggable rock', async () => {
    const level = foodRoom();
    requirePlayingGame(game);
    const rock = level.requireAt(13, 10);
    rock.typ = STONE;
    rock.wall_info = W_NONDIGGABLE;
    vision_recalc(0);
    const pet = await createMonsterAt('rock mole', 14, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.whistletime = game.moves;
    await floorObject(DAGGER, 12, 10);
    await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1));
    assert.ok(pet.mx >= 14, 'unreachable food must not draw the pet into rock');
});
//# sourceMappingURL=pet_food_reach.test.js.map