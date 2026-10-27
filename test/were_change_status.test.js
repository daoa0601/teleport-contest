import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT, NOT_HUNGRY, ROOM } from '../js/const.js';
import { bot } from '../js/display.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { isHumanWereMonster } from '../js/were.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
void test('an unseen lycanthrope changing form refreshes the status during travel', async () => {
    const input = freshTurnRoom({ moves: 1, flags: { time: true, tips: false },
        hero: { uhunger: 500, uhs: NOT_HUNGRY } });
    requireGameLevel(game).requireAt(30, 10).typ = ROOM;
    const wererat = await createMonsterAt(MONSTER_NAME.indexOf('wererat'), 30, 10, NO_MINVENT);
    // Protection forces the animal to resume human form on its next turn.
    grantIntrinsicProperty('protectionFromShapeChangers', 'outside');
    await bot();
    input.feed('_llll.');
    await moveloop_core();
    await moveloop_core();
    assert.equal(isHumanWereMonster(wererat), true);
    assert.equal(game.u.ux, 12, 'travel continues after the distant change');
    assert.equal(game.moves, 2);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /T:2\b/);
});
//# sourceMappingURL=were_change_status.test.js.map