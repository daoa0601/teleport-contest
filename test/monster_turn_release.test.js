import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { installPolymorphedHero, installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
for (const sticky of [false, true]) {
    void test(`a peaceful holder spends its turn releasing ${sticky ? 'a hero who holds it back' : 'the hero'}`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        if (sticky)
            installPolymorphedHero('large mimic', { hitPoints: 200 });
        const python = await createMonsterAt('python', 11, 10, MM_ANGRY | NO_MINVENT);
        python.mpeaceful = 1;
        python.msleeping = 0;
        python.movement = 12;
        game.u.ustuck = python;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /released|python/i, limit: 5 });
        await finishAtCommandInput(input, moveloop_core, /.*/);
        assert.equal(game.u.ustuck === python, sticky);
        assert.deepEqual([python.mx, python.my], [11, 10], 'releasing a hold consumes the turn');
        if (!sticky)
            assert.ok((python.mspec_used ?? 0) >= 1 && (python.mspec_used ?? 0) <= 2);
    });
}
void test('a peaceful engulfer expels the hero and ends its turn', async () => {
    freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    const worm = await createMonsterAt('purple worm', 10, 10, MM_ANGRY | NO_MINVENT);
    worm.mpeaceful = 1;
    worm.msleeping = 0;
    worm.movement = 12;
    await installSwallowedHero(worm, 20);
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /regurgitated|purple worm/i, limit: 5 });
    await finishAtCommandInput(input, moveloop_core, /.*/);
    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.u.uhp, 200);
    assert.ok((worm.mspec_used ?? 0) >= 1 && (worm.mspec_used ?? 0) <= 2);
});
//# sourceMappingURL=monster_turn_release.test.js.map