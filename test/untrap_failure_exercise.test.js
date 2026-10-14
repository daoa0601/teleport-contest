import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_DEX, PIT, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a bungled web rescue does not penalize dexterity when the hero stays outside the web', async () => {
    const level = freshObjectRoom({ hero: { _exercise: [0, 0, 0, 0, 0, 0] } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('goblin', 11, 10);
    monster.mtrapped = 1;
    addTrap(level, WEB, 11, 10, { tseen: true });
    addTrap(level, PIT, 10, 10);
    const input = resetInputState();
    input.feed('untrap\nl');
    input.beforeRead = () => input.feed(' ');
    initRng(1n);
    await rhack('#'.charCodeAt(0));
    assert.equal(monster.mtrapped, 1);
    assert.equal(game.u.utrap ?? 0, 0);
    assert.equal(game.u._exercise?.[A_DEX], 0);
});
//# sourceMappingURL=untrap_failure_exercise.test.js.map