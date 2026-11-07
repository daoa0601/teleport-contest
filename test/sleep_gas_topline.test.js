import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { OBJECT_TIMER_KIND, SLP_GAS_TRAP } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { syncBlindness } from '../js/senses.js';
import { putHeroToSleep, runDueTimers, scheduleObjectTimer } from '../js/timeout.js';
import { vision_recalc } from '../js/vision.js';
import { untimedCorpse } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { addBuriedObject } from '../js/mkobj.js';
async function buryRevivingZombie(deadline) {
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('kobold zombie'));
    addBuriedObject(corpse, 13, 10);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.REVIVE_MON, deadline);
}
function topline() {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}
// C do.c:revive_corpse(): `You_hear("scratching noises.");`.
// pline.c:You_hear(): `else if (Unaware)` selects "You dream that you hear ".
// topl.c:update_topl() appends only if
// `n0 + (int) strlen(gt.toplines) + 3 < CO - 8`; otherwise `more();`.
// allmain.c:moveloop_core() calls `nh_timeout();` before `dosounds();`.
void test('a gas-trap sleeper acknowledges the trap before dreaming of a buried revival', async () => {
    const input = freshTurnRoom({ hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    syncBlindness();
    await vision_recalc(0);
    addTrap(game.level, SLP_GAS_TRAP, 11, 10);
    await buryRevivingZombie(game.moves + 1);
    input.feed('l');
    await moveloop_core();
    assert.equal(game.u.ux, 11);
    assert.ok(game.multi < 0, 'Stepping on the gas trap puts the hero to sleep');
    let acknowledgements = 0;
    input.display = {
        async readKey() {
            acknowledgements++;
            assert.equal(topline(), 'A cloud of gas puts you to sleep!--More--');
            return ' '.charCodeAt(0);
        },
    };
    await moveloop_core();
    await flush_screen(1);
    assert.equal(acknowledgements, 1, 'Revival waits for the trap message to be acknowledged');
    assert.equal(topline(), 'You dream that you hear scratching noises.');
});
for (const { name, asleep, deaf, acoustics, underwater, expected } of [
    { name: 'an awake hero', asleep: false, deaf: false, acoustics: true, underwater: false,
        expected: 'You hear scratching noises.' },
    { name: 'a sleeping deaf hero', asleep: true, deaf: true, acoustics: true, underwater: false,
        expected: 'You dream that you hear scratching noises.' },
    { name: 'an awake deaf hero', asleep: false, deaf: true, acoustics: true, underwater: false,
        expected: '' },
    { name: 'a sleeper with acoustics disabled', asleep: true, deaf: false, acoustics: false, underwater: false,
        expected: '' },
    { name: 'a submerged sleeper', asleep: true, deaf: false, acoustics: true, underwater: true,
        expected: 'You barely hear scratching noises.' },
]) {
    void test(`buried revival gives ${name} the native hearing message`, async () => {
        freshTurnRoom({ hero: { blindTurns: 20, deafTurns: deaf ? 20 : 0, uinwater: underwater }, flags: { acoustics } });
        syncBlindness();
        await vision_recalc(0);
        if (asleep)
            await putHeroToSleep(5);
        await buryRevivingZombie(game.moves);
        await runDueTimers();
        await flush_screen(1);
        assert.equal(topline(), expected);
    });
}
//# sourceMappingURL=sleep_gas_topline.test.js.map