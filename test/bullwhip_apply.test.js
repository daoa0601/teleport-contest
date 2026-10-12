import test from 'node:test';
import assert from 'node:assert/strict';
import { useBullwhip } from '../js/bullwhip.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { TT_PIT, W_WEP } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BOULDER, BULLWHIP, CLUB, CORPSE, CRYSKNIFE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { floorObjectsAt } from './support/level-state.js';
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
void test('a whip cannot acquire a floor stack when the hero is overloaded', async () => {
    freshPlayableRoom({ role: 'archeologist' });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    game.u.levitating = true;
    await addInventoryObject(BOULDER, { quantity: 4 });
    const clubs = await floorObject(CLUB, 10, 10, { quantity: 3 });
    for (let seed = 1n; seed <= 30n; seed++) {
        initRng(seed);
        pushKeys(' '.repeat(8));
        await useBullwhip(whip, { dx: 0, dy: 0, dz: 1 }, {
            holdObject: async (object) => { game.inventory.push(object); return true; },
        });
        assert.equal(clubs.quan, 3);
        assert.equal(game.inventory.some(object => object.otyp === CLUB), false);
    }
});
void test('a whip revives a Rider corpse with remote acquisition feedback', async () => {
    const level = freshPlayableRoom({ role: 'archeologist', hero: { levitating: true } });
    requirePlayingGame(game);
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    const rider = MONSTER_NAME.indexOf('Death');
    assert.ok(rider >= 0, 'Death must have a monster species.');
    const corpse = await floorObject(CORPSE, 10, 10, { corpsenm: rider });
    vision_recalc(0);
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    for (let seed = 1n; seed <= 30n && floorObjectsAt(level, 10, 10).includes(corpse); seed++) {
        initRng(seed);
        pushKeys(' '.repeat(8));
        await useBullwhip(whip, { dx: 0, dy: 0, dz: 1 });
    }
    assert.equal(game.inventory.includes(corpse), false);
    assert.equal(floorObjectsAt(level, 10, 10).includes(corpse), false);
    assert.ok(level.monsters.some(monster => monster.mnum === rider && monster.mhp > 0));
    assert.match(messages.join('\n'), /At your attempted acquisition, the corpse suddenly moves\.\.\./);
});
//# sourceMappingURL=bullwhip_apply.test.js.map