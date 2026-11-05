import test from 'node:test';
import assert from 'node:assert/strict';
// C uhitm.c:mhitm_knockback() hurts the hero through dothrow.c:hurtle(),
// which sets nomul(-range), gm.multi_reason = "moving through the air" and
// gn.nomovemsg = "" (dothrow.c:1112-1114).  When the flight crosses a pool
// the hero cannot float over, dothrow.c:hurtle_step() resets the counter
// directly — `gm.multi = 0; (void) drown(); return FALSE;`
// (dothrow.c:926-928) — without touching gm.multi_reason or gn.nomovemsg,
// so trap.c:drown() can crawl the hero out (it requires `gm.multi >= 0`)
// and leave the hero free to act while nomovemsg is the empty-but-set
// string hurtle() left.  allmain.c:stop_occupation() then stops the
// interrupted meal — maybe_finished_meal() cannot finish it, so
// "You stop eating the food ration." — and its nomul(0) clears only
// gm.multi_reason (hack.c:4170); nomovemsg survives.  Resuming the meal
// through the eat command reaches eat.c:2949 start_eating(otmp, FALSE)
// with that empty message set, and the meal ends later through eatfood()'s
// done branch, whose done_eating(TRUE) `if (gn.nomovemsg)` pointer test
// (eat.c:551) keeps "" set: pline1("") appends two blank columns instead
// of announcing "You finish eating the food ration."
import { races } from '../js/role.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { mhitm_knockback } from '../js/uhitm.js';
import { AD_PHYS, AT_CLAW } from '../js/monster_attack_types.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { NOT_HUNGRY, NO_MINVENT, POOL, SATIATED } from '../js/const.js';
import { FORTUNE_COOKIE, FOOD_RATION } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { finishHeroHelplessness } from '../js/allmain.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireFixtureGame } from './support/game-state.js';
import { installPagerInput } from './support/pager-input.js';
function visibleTopline() {
    const display = requireGameDisplay(game);
    return display.grid[0]?.map(cell => cell.ch).join('') ?? '';
}
void test('a knockback into water keeps the empty nomovemsg, which finishes the resumed meal silently', async () => {
    const race = races.find(candidate => candidate.name === 'elf');
    assert.ok(race);
    // Five bites of 160 nutrition each: the meal stays under the
    // "hard time getting it down" warning throughout.
    await freshObjectRoom({ race, gameplaySeed: 41n, hero: { uhunger: 400, uhs: NOT_HUNGRY } });
    requireFixtureGame(game);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /knock|water|rock|crawl|Pheew|stop eating|eating|finish|ration|resume your meal|little goes|satiates/i,
        limit: 32,
    });
    // A pool on the first square of the knockback path; the hero cannot
    // float (plain elf, no levitation/flight/water walking), so hurtle_step
    // resets multi and calls drown().
    game.level.requireAt(9, 10).typ = POOL;
    // An invisible adjacent attacker, like the recorded session's "It hits!".
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.minvis = true;
    const food = await addInventoryObject(FOOD_RATION);
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    // One bite taken of a five-bite meal: maybe_finished_meal() cannot end
    // it, so the knockback interrupts instead of finishing the meal.
    assert.equal(game.context.victual?.usedtime, 1);
    assert.ok((game.context.victual?.reqtime ?? 0) >= 3);
    // C mhitu.c:hitmu() order: mhitm_knockback() hurtles the hero (into the
    // pool and out again via drown()), then the shared tail calls
    // stop_occupation().
    const knocked = await mhitm_knockback(giant, game.u, { attackType: AT_CLAW, damageType: AD_PHYS }, { random: sides => (sides === 4 ? 3 : 0) });
    assert.equal(knocked.knocked, true);
    await stopHeroOccupation(game);
    assert.equal(game.multi, 0, 'hurtle_step() resets the counter directly so drown() can crawl the hero out');
    assert.equal(game._occupation ?? null, null, 'the interrupted meal is stopped, not finished');
    // dothrow.c:926-928 keeps hurtle()'s gn.nomovemsg = "" set across the
    // direct multi reset; stop_occupation()'s nomul(0) (hack.c:4170) clears
    // gm.multi_reason only, never nomovemsg.
    assert.equal(game._helplessReason, null);
    assert.equal(game._helplessDoneMessage, '', 'the crawl-out keeps hurtle()\'s empty-but-set nomovemsg');
    // Resuming the ration through the public eat command leaves four bites,
    // so the meal ends through eatfood()'s done branch, not through
    // start_eating()'s single-bite path.
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    assert.equal(game._occupation?.key, 'eat-food', 'the resumed meal continues');
    assert.equal(game._helplessDoneMessage, '', 'the empty message survives the resume bite');
    for (let guard = 0; guard < 12; guard += 1) {
        if (game._occupation?.key !== 'eat-food')
            break;
        await continueCountedCommand(game);
    }
    assert.equal(game._occupation, null, 'the resumed meal ends');
    assert.equal(game.context.victual, null);
    assert.equal(game._helplessDoneMessage, null, 'done_eating(TRUE) consumes the empty-but-set nomovemsg');
    assert.equal(game._pending_message?.includes('You finish eating'), false, 'pline1("") replaces the meal announcement');
    assert.equal(/  $/.test(game._pending_message ?? ''), true, 'pline1("") appends two blank columns');
    assert.equal(visibleTopline().includes('--More--'), false);
});
// The same empty nomovemsg reaching eat.c:2048-2060: a satiated
// (canchoke) hero whose bite enters with u.uhunger >= 2000 chokes in
// bite()'s own gate (eat.c:3138-3141) before any nutrition transfers, so
// the survivable choke() vomits (eat.c:3759-3762 sets nomovemsg =
// You_can_move_again, nomul(-2), "vomiting") and start_eating's
// `if (!old_nomovemsg)` pointer tests run with old_nomovemsg = "" — C
// keeps it set, so done_eating(FALSE) consumes the vomit message silently
// (eat.c:551-554: `if (message)` is FALSE) and never restores it.  The
// vomiting helplessness then recovers through unmul()'s default, because
// nomovemsg is NULL again.  A breathless hero (skeleton form) makes
// choke()'s survivable branch (eat.c:3306 `Breathless || Hunger ||
// (!Strangled && !rn2(20))`) deterministic, and its small size stays under
// mhitm_knockback's size gate, which a size-4 form like a fire elemental
// fails (uhitm.c: mgrav > mdef+1 sizes).
void test('a choking bite of a meal started with the empty nomovemsg consumes the vomit message', async () => {
    const race = races.find(candidate => candidate.name === 'elf');
    assert.ok(race);
    await freshObjectRoom({
        race,
        gameplaySeed: 41n,
        hero: {
            uhunger: 2100,
            uhs: SATIATED,
            umonnum: MONSTER_NAME.indexOf('skeleton'),
            mh: 60,
            mhmax: 60,
        },
    });
    requireFixtureGame(game);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /knock|water|rock|Pheew|eating|finish|vomit|stuff|drowning|touch bottom|wobbly|move again|scrap of paper|cookie|They say|It reads|fortune/i,
        limit: 32,
    });
    // The idle hero is knocked into the pool; a breathless hero sinks and
    // touches bottom instead of crawling out, but hurtle_step()'s direct
    // multi reset has already restored control with nomovemsg = "".
    game.level.requireAt(9, 10).typ = POOL;
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    giant.mpeaceful = false;
    giant.minvis = true;
    const knocked = await mhitm_knockback(giant, game.u, { attackType: AT_CLAW, damageType: AD_PHYS }, { random: sides => (sides === 4 ? 3 : 0) });
    assert.equal(knocked.knocked, true);
    await stopHeroOccupation(game);
    assert.equal(game.multi, 0, 'the direct multi reset leaves the hero free in the pool');
    assert.equal(game._helplessReason, null);
    assert.equal(game._helplessDoneMessage, '', 'the water landing keeps hurtle()\'s empty-but-set nomovemsg');
    // A one-bite cookie eaten while satiated chokes on bite()'s entry
    // gate; the empty old_nomovemsg stays "set" for C's pointer tests.
    const cookie = await addInventoryObject(FORTUNE_COOKIE);
    input.feed(cookie.invlet);
    await rhack('e'.charCodeAt(0));
    assert.ok((game.multi ?? 0) < 0, 'the survivable choke vomits and leaves the hero helpless');
    assert.equal(game._helplessReason, 'vomiting');
    assert.equal(game._helplessDoneMessage, null, 'done_eating(FALSE) consumes the vomit message instead of restoring it around the empty one');
    await finishHeroHelplessness(undefined, game);
    assert.match(game._pending_message ?? '', /You can move again\./, 'unmul() prints its default because nomovemsg is NULL again');
    assert.equal(game._helplessDoneMessage, null);
});
//# sourceMappingURL=knockback_water_meal_resume.test.js.map