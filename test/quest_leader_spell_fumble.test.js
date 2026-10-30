import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a quest leader can attempt her second spell after fumbling her first', async () => {
    await freshObjectRoom({ right: 22 });
    requirePlayingGame(game);
    const leader = await createMonsterAt('Neferet the Green', 16, 10, NO_MINVENT);
    leader.mstrategy = 0;
    leader.mpeaceful = 1;
    leader.msleeping = 0;
    leader.m_lev = 21;
    leader.mhp = 5;
    leader.mhpmax = 100;
    const input = resetInputState();
    const displayed = [];
    input.beforeRead = () => {
        displayed.push(game._pending_message);
        input.feed(' ');
    };
    // A useful self-heal is selected, but the first attempt fumbles.
    await takeMonsterTurn(leader, game, limit => limit === 21 ? 1 : limit === 210 ? 0 : limit - 1);
    displayed.push(game._pending_message);
    const messages = displayed.join('\n');
    assert.match(messages, /air crackles around Neferet the Green/);
    assert.match(messages, /Neferet the Green points all around, then curses/, 'the second spell must report the cooldown imposed by the fumbled first spell');
    assert.equal(leader.mhp, 5, 'a fumbled heal must not restore health');
});
//# sourceMappingURL=quest_leader_spell_fumble.test.js.map