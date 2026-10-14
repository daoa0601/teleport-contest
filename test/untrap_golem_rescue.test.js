import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addTrap } from './support/level-state.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a golem hero finishes rescuing a cockatrice after the touch turns the hero to stone', async () => {
    const level = freshObjectRoom({ role: 'ranger' });
    requirePlayingGame(game);
    installPolymorphedHero('flesh golem');
    const cockatrice = await createMonsterAt('cockatrice', 11, 10);
    cockatrice.mtrapped = 1;
    const pit = addTrap(level, PIT, 11, 10, { tseen: true, madeby_u: true });
    const input = resetInputState();
    input.feed('untrap\nl');
    input.beforeRead = () => input.feed(' ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.u.umonnum, MONSTER_NAME.indexOf('stone golem'));
    assert.equal(cockatrice.mtrapped, 0);
    assert.ok(level.traps.includes(pit));
    assert.equal(!!game.program_state.gameover, false);
});
//# sourceMappingURL=untrap_golem_rescue.test.js.map