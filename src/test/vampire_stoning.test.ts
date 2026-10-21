import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { prepareMonsterPetrification } from '../js/monster_stoning.js';
import { STATUE } from '../js/object_data.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a shapeshifted vampire lord falls as its bat form and rises instead of petrifying', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const lord = MONSTER_NAME.indexOf('vampire leader');
    const bat = await createMonsterAt('vampire bat', ux + 1, uy, NO_MINVENT);
    bat.cham = lord;
    bat.female = false;
    vision_recalc(0);
    const messages: string[] = [];

    const result = await prepareMonsterPetrification(bat, {
        publish: async message => { messages.push(message); },
    });

    // C mon.c:vamp_stone() names the falling form before newcham() and the
    // risen vampire after it, with no separate transformation message.
    assert.deepEqual(messages, [
        'The lapidifying vampire bat drops to the floor!',
        'A vampire lord rises from the floor with renewed agility!',
    ]);
    assert.equal(result.survived, true);
    assert.equal(bat.mnum, lord);
    assert.ok(!(game.level.objects[ux + 1]?.[uy] ?? []).some(object => object.otyp === STATUE));
});
