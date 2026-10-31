import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, P_BASIC, P_FLAIL, SLP_GAS_TRAP, W_SADDLE, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { GRAPPLING_HOOK, SADDLE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c:3137 prints "%s suddenly falls asleep!" with Monnam(steed), so an
// unnamed ridden steed keeps the saddle adjective its mon_nam() would show.
void test('a sleeping-gas trap names an unnamed steed through Monnam', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    game.u.sleepResistance = true;
    game.u.usteed = await createSaddledSteed();
    const trap = addTrap(game.level, SLP_GAS_TRAP, 10, 10);
    pushKeys(' '.repeat(100));
    initRng(31n);

    await triggerHeroTrap(trap);

    assert.equal(game.u.usteed.mcanmove, 0);
    assert.match(game._pending_message ?? '', /The saddled pony suddenly falls asleep!/,
        `expected the Monnam(steed) message, got: ${game._pending_message}`);
});

// C trap.c:1508-1509 prints "A bear trap closes on s_suffix(mon_nam(u.usteed))
// rear claw!"; a named steed suppresses the saddle and keeps the possessive.
void test('a bear trap closes on a named steed possessive', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    setMonsterGivenName(steed, 'Rex');
    steed.mhp = 100;
    game.u.usteed = steed;
    const trap = addTrap(game.level, BEAR_TRAP, 10, 10);
    pushKeys(' '.repeat(100));

    await triggerHeroTrap(trap);

    assert.match(game._pending_message ?? '', /A bear trap closes on Rex's rear hoof!/,
        `expected the s_suffix(mon_nam(steed)) message, got: ${game._pending_message}`);
});

// C apply.c:3838 prints "You pull in mon_nam(mtmp)!" for a tiny creature, so
// the pulled-in monster carries the saddle adjective of its mon_nam().
void test('a grappling hook pulls in a saddled tiny monster by mon_nam', async () => {
    await freshObjectRoom();
    requirePlayingGame(game);
    const hook = await addInventoryObject(GRAPPLING_HOOK, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = hook;
    installHeroWeaponSkills({ [P_FLAIL]: P_BASIC });
    const ant = await createMonsterAt('giant ant', 12, 10);
    await equipMonsterObject(ant, await knownObject(SADDLE), W_SADDLE);
    game._travelTipShown = true;
    initRng(113n);

    await applyInventoryObject(hook, 'll.    ');

    assert.match(game._pending_message ?? '', /You pull in the saddled giant ant!/,
        `expected the mon_nam pull-in message, got: ${game._pending_message}`);
});
