import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, MM_NOGRP, MM_NOWAIT, NO_MINVENT, ROWNO, STONE, TREE, W_NONDIGGABLE, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { beginMonsterMove } from '../js/monmove.js';
import { APPLE, AXE, DAGGER, PICK_AXE } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const obstacle of ['rock', 'tree']) {
    void test(`a pet readies its digging tool before entering ${obstacle} to reach food`, async () => {
        const level = freshObjectRoom({ left: 11, right: 16, top: 10, bottom: 10, heroX: 16 });
        requirePlayingGame(game);
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const cell = level.requireAt(x, y);
                if (cell.typ === STONE)
                    cell.wall_info = W_NONDIGGABLE;
            }
        }
        const square = level.requireAt(13, 10);
        square.typ = obstacle === 'tree' ? TREE : STONE;
        const dwarf = await createMonsterAt('dwarf', 14, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        initializePet(dwarf);
        assert.ok(dwarf.edog);
        dwarf.edog.hungrytime = game.moves - 1;
        await equipMonsterObject(dwarf, await knownObject(DAGGER), W_WEP);
        const tool = await equipMonsterObject(dwarf, await knownObject(obstacle === 'tree' ? AXE : PICK_AXE), 0);
        const apple = await floorObject(APPLE, obstacle === 'tree' ? 13 : 12, 10);
        const input = resetInputState();
        input.beforeRead = () => input.feed(' ');
        const action = await beginMonsterMove(dwarf, game, limit => Math.min(1, limit - 1));
        assert.deepEqual([dwarf.mx, dwarf.my], [14, 10], 'readying a tool uses this move');
        assert.ok(dwarf.mw === tool, 'the pet must ready the tool for this obstacle');
        assert.equal(apple.where, 'floor');
        assert.equal(action.movement.petMeal, undefined, 'eating waits until the pet enters the food square');
    });
}
//# sourceMappingURL=pet_digging_weapon.test.js.map