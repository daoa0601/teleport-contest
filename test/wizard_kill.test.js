import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('#wizkill keeps selecting targets from the last chosen position without taking time', async () => {
    freshObjectRoom({ flags: { debug: true, tips: false } });
    requirePlayingGame(game);
    const first = await createMonsterAt('lichen', 11, 10);
    const second = await createMonsterAt('lichen', 12, 10);
    const input = resetInputState();
    installPagerInput(input, { expected: /kill|monster|experienced/, limit: 10 });
    await runExtendedCommand('wizkill', 'l.l.\x1b');
    assert.equal(first.dead, true);
    assert.equal(second.dead, true);
    assert.equal(game.u.uconduct.killer, 2);
    assert.equal(game.context.move, 0);
});
void test('menu-prefixed #wizkill gives no kill credit to the hero', async () => {
    freshObjectRoom({ flags: { debug: true, tips: false } });
    requirePlayingGame(game);
    const monster = await createMonsterAt('lichen', 11, 10);
    const experience = game.u.uexp;
    const input = resetInputState();
    installPagerInput(input, { expected: /killed|monster/, limit: 10 });
    input.feed('m#wizkill\nl.\x1b');
    await rhack(0);
    assert.equal(monster.dead, true);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.context.mon_moving, false);
    assert.equal(game.context.move, 0);
});
void test('#wizkill clears a remembered unseen monster at an empty target', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false } });
    requirePlayingGame(game);
    level.requireAt(11, 10).remembered_glyph = { kind: 'invisible', ch: 'I', color: 8 };
    await runExtendedCommand('wizkill', 'l.');
    assert.notEqual(level.requireAt(11, 10).remembered_glyph?.kind, 'invisible');
    assert.equal(game._pending_message, 'There is no monster there.');
});
//# sourceMappingURL=wizard_kill.test.js.map