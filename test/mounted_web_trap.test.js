import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { A_STR, TT_WEB, WEB } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a strong mount determines how long a weak rider stays caught in a web', async () => {
    const level = freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const horse = await createSaddledSteed('horse');
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, horse);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 3;
    addTrap(level, WEB, 12, 10);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.usteed, horse);
    assert.equal(game.u.utraptype, TT_WEB);
    assert.ok((game.u.utrap ?? 0) >= 1 && (game.u.utrap ?? 0) <= 2);
    assert.equal(horse.mtrapped ?? 0, 0);
});
//# sourceMappingURL=mounted_web_trap.test.js.map