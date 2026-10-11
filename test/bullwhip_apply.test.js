import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { TT_PIT, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, BULLWHIP, CLUB, CRYSKNIFE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('applying an unwielded bullwhip wields it before asking for direction', async () => {
    freshPlayableRoom({ role: 'archeologist' });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
    });
    initRng(7101n);
    await applyInventoryObject(whip, 'l');
    assert.equal(game.uwep, whip);
    assert.equal(game.context.move, 1);
    await rhack(0);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /Snap/);
});
void test('an archeologist can pull a wielded weapon from an adjacent monster', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    const club = await knownObject(CLUB, {});
    const bugbear = await createMonsterAt('bugbear', 11, 10);
    await equipMonsterObject(bugbear, club, W_WEP);
    initRng(7102n);
    await applyInventoryObject(whip, 'l ');
    assert.equal(bugbear.mw, null);
    assert.equal(bugbear.minvent.includes(club), false);
    assert.equal(game.context.move, 1);
});
void test('a proficient bullwhip can pull the hero from a pit toward a boulder', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    game.u.utrap = 3;
    game.u.utraptype = TT_PIT;
    await floorObject(BOULDER, 11, 10);
    initRng(7103n);
    await applyInventoryObject(whip, 'l');
    assert.equal(game.u.utrap, 0);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.equal(game.context.move, 1);
});
// C apply.c:3174-3231: the disarm extracts the weapon raw
// (obj_extract_self, no unwear owner, no crysknife release); case 3
// snatches it straight into the hero's pack.  An UNPROOFED crysknife
// therefore stays a crysknife in hero inventory — zero releases ran.
void test('snatching an unproofed crysknife keeps it a crysknife in the pack', async () => {
    freshPlayableRoom({
        role: 'archeologist',
        hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } },
    });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, {
        invlet: 'a',
        spe: 2,
        wielded: true,
        owornmask: W_WEP,
    });
    game.uwep = game.u.uwep = whip;
    const knife = await knownObject(CRYSKNIFE, {
        oerodeproof: false,
    });
    const bugbear = await createMonsterAt('bugbear', 11, 10);
    await equipMonsterObject(bugbear, knife, W_WEP);
    initRng(7102n);
    await applyInventoryObject(whip, 'l ');
    assert.equal(bugbear.mw, null);
    assert.ok(game.inventory.includes(knife));
    assert.equal(knife.otyp, CRYSKNIFE);
    assert.equal((requireGameLevel().objects[game.u.ux]?.[game.u.uy] || []).includes(knife), false);
});
//# sourceMappingURL=bullwhip_apply.test.js.map