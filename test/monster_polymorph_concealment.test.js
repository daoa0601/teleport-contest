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
void test('a snake born on a pool remains visible above underwater objects', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = POOL;
    game.in_mklev = true;
    const snake = await createMonsterAt('garter snake', 11, 10, NO_MINVENT);
    game.in_mklev = false;
    assert.equal(!!snake.mundetected, false);
    assert.equal(canSeeMonster(snake), true);
});
for (const [target, hidden] of [['electric eel', true], ['cave spider', false]]) {
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
//# sourceMappingURL=monster_polymorph_concealment.test.js.map