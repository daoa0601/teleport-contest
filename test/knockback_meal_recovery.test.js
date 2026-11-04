import test from 'node:test';
import assert from 'node:assert/strict';
// C uhitm.c:mhitm_knockback() hurts the hero through dothrow.c:hurtle(),
// which sets nomul(-range) and gn.nomovemsg = "" (dothrow.c:1113-1114).
// mhitu.c:hitmu() then ends the contact with stop_occupation()
// (allmain.c:684).  For a meal that maybe_finished_meal() (eat.c:3877)
// can finish, that call runs done_eating(): eat.c:551 `if (gn.nomovemsg)`
// tests the pointer, so hurtle()'s empty message still counts as set and
// pline1("") — `#define pline1(cstr) pline("%s", cstr)` (hack.h:1026),
// whose vpline() filter applies to the "%s" format and not the unpacked
// argument — reaches tty update_topl(""), appending two blank columns
// without glyphs or a pager.  done_eating() then clears nomovemsg, and
// stop_occupation()'s nomul(0) returns early while multi is negative
// (hack.c:4160), so when the hurtle helplessness runs out, unmul()
// (hack.c:4177) finds no message and appends the default
// "You can move again." — four blank columns after the knockback text,
// with no --More-- anywhere in the sequence.
import { races } from '../js/roles.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { mhitm_knockback } from '../js/uhitm.js';
import { AD_PHYS, AT_CLAW } from '../js/monster_attack_types.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { NOT_HUNGRY, NO_MINVENT } from '../js/const.js';
import { LEMBAS_WAFER } from '../js/object_data.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { finishHeroHelplessness } from '../js/allmain.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
function visibleTopline() {
    const display = requireGameDisplay(game);
    return display.grid[0]?.map(cell => cell.ch).join('') ?? '';
}
void test('a monster knocking a hero mid-meal ends the meal silently and the hero recovers on the same line', async () => {
    const race = races.find(candidate => candidate.name === 'elf');
    assert.ok(race);
    await freshObjectRoom({ race, gameplaySeed: 41n, hero: { uhunger: 999, uhs: NOT_HUNGRY } });
    requireFixtureGame(game);
    const input = resetInputState();
    installPagerInput(input, { expected: /little goes|hard time|eating|finish/i, limit: 8 });
    // An invisible adjacent attacker, like the recorded session's "It hits!".
    // C monmove.c:dochugw() and makemon's arrival check spot the monster
    // before interrupting an occupation (hack.c:monster_nearby() requires
    // canspotmon), so the unseen giant leaves the meal alive until
    // hitmu()'s own stop_occupation() after the knockback.
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.minvis = true;
    const food = await addInventoryObject(LEMBAS_WAFER);
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    // The first bite stays under the warning threshold; the scheduled
    // second bite crosses it, sets the pending "You're finally finished."
    // (C eat.c:3314-3315) without the Continue-eating query (the hero was
    // not SATIATED when the meal began), and leaves the meal one bite
    // from done, as in the recorded knockback.
    assert.equal(game.context.victual?.usedtime, 1);
    await continueCountedCommand(game);
    assert.equal(game.context.victual?.usedtime, 2);
    assert.equal(game.context.victual?.reqtime, 2);
    assert.equal(game._helplessDoneMessage, "You're finally finished.");
    // The knockback line pages over the overflowed topline exactly once, as
    // in the recorded session; any further pager is the port's old extra
    // --More-- between the knockback line and the recovery message.
    let pagers = 0;
    input.display = {
        async readKey() {
            assert.equal(++pagers, 1, `unexpected pager: ${game._pending_message}`);
            assert.match(game._pending_message ?? '', /hard time|It hits|knocks you backward/);
            return ' '.charCodeAt(0);
        },
    };
    // C mhitu.c:hitmu() order: mhitm_knockback() hurtles the hero and
    // blanks nomovemsg, then the shared tail calls stop_occupation().
    const knocked = await mhitm_knockback(giant, game.u, { attackType: AT_CLAW, damageType: AD_PHYS }, { random: sides => (sides === 4 ? 3 : 0) });
    assert.equal(knocked.knocked, true);
    await stopHeroOccupation(game);
    assert.equal(pagers, 1, 'only the knockback line pages during the attack');
    assert.equal(game.u.ux, 8, 'the hero is knocked two squares away from the giant');
    assert.ok((game.multi ?? 0) < 0, 'the knockback helplessness survives stop_occupation()');
    assert.equal(game._occupation, null, 'the meal is finished, not merely interrupted');
    assert.equal(game.context.victual, null);
    assert.equal(food.where, 'gone');
    assert.equal(game._helplessDoneMessage, null, 'done_eating() consumes hurtle\'s empty nomovemsg instead of announcing the meal');
    assert.equal(game._pending_message, 'It knocks you backward with a powerful strike!  ', 'pline1("") appends two blank columns without a pager');
    await finishHeroHelplessness(undefined, game);
    assert.equal(game._pending_message, 'It knocks you backward with a powerful strike!    You can move again.');
    assert.equal(visibleTopline().includes('--More--'), false);
});
//# sourceMappingURL=knockback_meal_recovery.test.js.map