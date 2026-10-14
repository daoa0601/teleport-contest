import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, POOL } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { hideMonsterUnder } from '../js/monster_hiding.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [target, hidden] of [['electric eel', true], ['cave spider', false]] as const) {
    void test(`a submerged eel polymorphed into a ${target} ${hidden ? 'stays concealed' : 'loses its underwater hiding place'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = POOL;
        const eel = await createMonsterAt('giant eel', 11, 10, NO_MINVENT);
        assert.equal(await hideMonsterUnder(eel), true);

        await changeMonsterForm(eel, MONSTER_NAME.indexOf(target), game);

        assert.equal(!!eel.mundetected, hidden);
        assert.equal(canSeeMonster(eel), !hidden);
    });
}
