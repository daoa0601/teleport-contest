import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { ensureQuestStatus } from '../js/quest.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
for (const adjacent of [false, true]) {
    void test(`a waiting quest nemesis records ${adjacent ? 'close combat' : 'leaving close combat'} before ending its turn`, async () => {
        freshObjectRoom({ hero: { invisibleTurns: 20 } });
        requirePlayingGame(game);
        const nemesis = await createMonsterAt('Cyclops', adjacent ? 11 : 14, 10, MM_ANGRY | NO_MINVENT);
        nemesis.msleeping = 0;
        nemesis.mstrategy = STRAT_WAITFORU;
        nemesis.movement = 12;
        const quest = ensureQuestStatus(game);
        quest.in_battle = !adjacent;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /Cyclops/i, limit: 5 });
        await finishAtCommandInput(input, moveloop_core, /.*/);
        assert.equal(quest.in_battle, adjacent);
    });
}
void test('a quest nemesis sharing the hero square counts as close combat', async () => {
    freshObjectRoom({ hero: { invisibleTurns: 20 } });
    requirePlayingGame(game);
    // quest.c:quest_stat_check() takes monnear(mtmp, u.ux, u.uy), whose
    // dist2() < 3 test holds at distance zero: a nemesis holding the
    // hero's own square is in battle, not leaving it.
    // makemon() shies away from the hero square, so take the position
    // directly the way an engulfing captor ends up on it.
    const nemesis = await createMonsterAt('Cyclops', 10, 10, MM_ANGRY | NO_MINVENT);
    placeMonsterAt(nemesis, game.u.ux, game.u.uy);
    nemesis.msleeping = 0;
    nemesis.mstrategy = STRAT_WAITFORU;
    nemesis.movement = 12;
    const quest = ensureQuestStatus(game);
    quest.in_battle = false;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /Cyclops/i, limit: 5 });
    await finishAtCommandInput(input, moveloop_core, /.*/);
    assert.equal(quest.in_battle, true);
});
//# sourceMappingURL=monster_quest_battle_turn.test.js.map