import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MMOVE_DONE, M_SEEN_MAGR, NO_MINVENT } from '../js/const.js';
import { canSeeMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mcastSpell, movementSpellContext } from '../js/mcastu.js';
import { pline } from '../js/pline.js';
import { presentMonsterAction, runMonsterAction } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

// C mcastu.c:mcast_confuse_you() calls make_confused() before its explicit
// feedback pline and monstunseesu() after it.  The spell runs as one awaited
// transaction, so while the feedback line waits for its --More-- the hero is
// already confused and the caster has not yet forgotten magic resistance.
void test('a confusion spell commits its status before the feedback line crosses the tty', async () => {
    await freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    requirePlayingGame(game);
    const caster = await createMonsterAt('aligned cleric', 11, 10, MM_ANGRY | NO_MINVENT);
    caster.m_lev = 4;
    caster.mux = game.u.ux;
    caster.muy = game.u.uy;
    caster.seen_resistance = M_SEEN_MAGR;
    const input = resetInputState();
    await pline('The corridor stretches away into the cold and silent darkness.');

    const casting = mcastSpell(caster, 'confuse-you', 0, movementSpellContext(caster, game));
    await input.waitUntilBlocked();
    let committedDuringPager = false;
    try {
        assert.equal(game.u.confusionTurns ?? 0, 4,
            'make_confused() commits before the feedback line is acknowledged');
        assert.ok((caster.seen_resistance ?? 0) & M_SEEN_MAGR,
            'monstunseesu() only runs after the feedback line');
        committedDuringPager = true;
    } finally {
        installPagerInput(input, { expected: /confused/, limit: 4 });
        input.feed(' ');
        await casting;
    }

    assert.ok(committedDuringPager);
    assert.equal((caster.seen_resistance ?? 0) & M_SEEN_MAGR, 0,
        'the caster forgets magic resistance once the line has crossed tty');
});

// C monmove.c:dochug() casts castmu(mtmp, a, FALSE, FALSE) with zero damage;
// a successful undirected spell spends the movement action (MMOVE_DONE) and
// mcast_spell() awaits its whole effect before dochug()'s trailing tail.
void test('a movement cure-self spell heals inside its own turn transaction', async () => {
    await freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const shaman = await createMonsterAt('kobold shaman', 10, 10, NO_MINVENT);
    shaman.mpeaceful = 1;
    shaman.m_lev = 4;
    shaman.mhp = 5;
    shaman.mhpmax = 30;
    installPagerInput(resetInputState(), { expected: /looks better|casts/, limit: 4 });

    const action = await runMonsterAction(shaman, game, limit => (limit === 4 ? 1 : limit - 1));
    const { movement } = action;
    if (!movement?.spellCast) assert.fail('The wounded shaman should cast cure-self');
    assert.equal(movement.spellCast.spell, 'cure-self');

    const presented = await presentMonsterAction(action, game);

    assert.equal(presented, 'check-occupation');
    assert.equal(movement.postMoveStatus, MMOVE_DONE,
        'the successful spell bypasses m_move()');
    assert.ok(movement.x === movement.oldx && movement.y === movement.oldy,
        'the caster never moved');
    assert.ok(shaman.mhp > 5 && shaman.mhp <= shaman.mhpmax,
        'the heal ran inside the same turn transaction');
    assert.equal(shaman.mspec_used, 6);
});
