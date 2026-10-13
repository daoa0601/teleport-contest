import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOMSG, NO_MINVENT, NOT_HUNGRY } from '../js/const.js';
import { bot, clearMessageWindow, plineWithContinuation } from '../js/display.js';
import { doeat } from '../js/eat.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { throwMonsterProjectile } from '../js/monster_throw.js';
import { CRAM_RATION, DAGGER } from '../js/object_data.js';
import { addInventoryObject, uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a thrown missile does not redraw meal hunger before its miss when no command is repeating', async () => {
    freshObjectRoom({ hero: { uhunger: 900, uhs: NOT_HUNGRY } });
    const food = await addInventoryObject(CRAM_RATION);
    const goblin = await createMonsterAt('goblin', 12, 10, MM_NOGRP | MM_NOMSG | NO_MINVENT);
    const dagger = await uninitializedObject(DAGGER, { cursed: false, spe: 0 });
    await addObjectToMonsterInventory(goblin, dagger);
    await bot();
    pushKeys(food.invlet);
    await doeat();
    clearMessageWindow();
    await plineWithContinuation('The goblin throws a dagger while you are eating the cram ration.');
    const input = resetInputState();
    let pages = 0;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            assert.match(message, /--More--/);
            if (pages === 0) {
                assert.match(message, /goblin throws/);
                assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Satiated/);
            }
            pages++;
            return 32;
        },
    };

    const shot = await throwMonsterProjectile(goblin, dagger, {
        dx: -1, dy: 0, range: 2,
        random: bound => Math.min(1, bound - 1), rollOne: sides => sides,
    });

    assert.equal(shot.hit, false);
    assert.ok(pages > 0);
    assert.equal(game._occupation, null);
});
