import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('#wiztelekinesis hurtles a selected monster six squares without taking time', async () => {
    freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('lichen', 11, 10);
    await runExtendedCommand('wiztelekinesis', 'l.l\x1b');
    assert.equal(monster.mx, 17);
    assert.equal(monster.my, 10);
    assert.equal(monster.mstun, 1);
    assert.equal(monster.movement, 0);
    assert.equal(game.context.move, 0);
});
void test('#wiztelekinesis can hurtle the hero without leaving a recovery delay after cancellation', async () => {
    freshObjectRoom({ right: 25, flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    await runExtendedCommand('wiztelekinesis', '.l\x1b');
    assert.equal(game.u.ux, 16);
    assert.equal(game.u.uy, 10);
    assert.equal(game.multi, 0);
    assert.equal(game._helplessTurns ?? 0, 0);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_telekinesis.test.js.map