import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { FOUNTAIN, MM_ANGRY, MM_NOGRP, NO_MINVENT, P_SKILLED } from '../js/const.js';
import { forceLearnSpell } from '../js/spell.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { SPE_CHAIN_LIGHTNING } from '../js/object_data.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
import { trainSpellSkill } from './support/spells.js';
// C spell.c:cast_chain_lightning() charges one extra power point for every
// relay past a monster (spell.c:1086-1087 `else if (u.uen > 0) u.uen--;`)
// without setting disp.botl, and the beam animation's flush_screen() calls
// bot() (display.c:2236-2237) before those relay charges, so the cast turn
// renders the pre-relay Pw.  When a later `g' rush stops, hack.c:lookaround()
// ends the run through `stop: nomul(0);` (hack.c:4020-4022, grid-bug stops
// too at hack.c:3907-3910), and nomul(0) marks the whole status line dirty
// (`disp.botl |= (multi >= 0)`, hack.c:4161-4165), so the next bot() finally
// repaints the silently charged energy.  Travel stops the same way: its
// lookaround stops all run through the same nomul(0) label.
void test('a rush stopped by lookaround repaints power charged silently by chain lightning', async () => {
    const input = freshTurnRoom({ role: 'wizard', heroLevel: 2, energy: 40 });
    requirePlayingGame(game);
    // Skill training answers its own pager only when it owns the gate.
    forceLearnSpell(SPE_CHAIN_LIGHTNING);
    await trainSpellSkill(SPE_CHAIN_LIGHTNING, P_SKILLED, { input });
    // A one-hit-point jackal north of the hero relays the lightning once and
    // dies, leaving the rush corridor to the east free of monsters.
    const relay = await createMonsterAt('jackal', 10, 8, MM_ANGRY | MM_NOGRP | NO_MINVENT);
    relay.mhp = relay.mhpmax = 1;
    relay.msleeping = 0;
    // Furniture ahead ends the rush through lookaround's interesting-terrain
    // stop rather than a blocked step into it.
    game.level.requireAt(16, 10).typ = FOUNTAIN;
    installPagerInput(input, { expected: /You kill|\s+/, limit: 4 });
    input.feed('Za');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /^$|You kill/);
    // 40 - 10 for the level-2 spell - 1 for the single relay; the rendered
    // status line still shows the pre-relay value the animation flushed.
    assert.equal(game.u.uen, 29);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:30\(40\)/);
    input.feed('gl');
    await finishAtCommandInput(input, async () => {
        for (let turn = 0; turn < 20; turn++) {
            await moveloop_core();
            if (game.multi === 0)
                break;
        }
        await moveloop_core();
    }, /^$|You kill/);
    assert.equal(game.multi, 0, 'the furniture ahead ends the rush');
    assert.equal(game.u.ux, 15, 'the hero stops in front of the fountain');
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Pw:29\(40\)/);
});
//# sourceMappingURL=rush_stop_status_repaint.test.js.map