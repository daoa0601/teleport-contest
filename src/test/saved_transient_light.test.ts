import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { canSeeMonster, glyphAt } from '../js/display.js';
import { game } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import { OIL_LAMP } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { cleanupTransientLight, showTransientLight } from '../js/transient_light.js';
import { vision_recalc, vision_reset } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('restoring during a light flash does not later mark a monster invisible from that old flash', async () => {
    const level = freshObjectRoom({ left: 2, right: 30, top: 2, bottom: 18 });
    for (const column of level.locations)
        for (const cell of column) cell.lit = false;
    vision_reset();
    vision_recalc(0);
    const monster = await createMonsterAt('kobold', 16, 12, NO_MINVENT);
    const lamp = await knownObject(OIL_LAMP, { age: 200 });
    beginObjectBurn(lamp);
    game._thrownObject = lamp;
    await showTransientLight(lamp, 16, 10);
    assert.equal(canSeeMonster(monster), true, 'The passing lamp reveals the kobold');
    // A panic save can interrupt bhit() before its transient-light cleanup.
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    vision_recalc(0);

    await cleanupTransientLight();

    assert.notEqual(glyphAt(16, 12)?.kind, 'invisible',
        'A previous process flash must not create an invisible-creature marker');
});
