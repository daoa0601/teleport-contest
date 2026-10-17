import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SINK } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { fallIntoSink } from '../js/sink_fall.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { ARROW, LEVITATION_BOOTS, OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyIsActive, refreshProperty, } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject, floorObject, untimedCorpse } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { MONSTER_NAME } from '../js/monster_data.js';
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
function sinkSpot(gameplaySeed = 45300n) {
    const level = freshObjectRoom({ gameplaySeed });
    requirePlayingGame(game);
    game.level.requireAt(game.u.ux, game.u.uy).typ = SINK;
    game.u.levitationTurns = 40;
    refreshProperty('levitation');
    return level;
}
async function wearRing(slot, overrides = {}) {
    const ring = await addInventoryObject(RIN_LEVITATION, {
        invlet: slot === 'uleft' ? 'b' : 'c', dknown: true, ...overrides,
    });
    await wearHeroAccessory(ring, slot);
    return ring;
}
async function wearBoots() {
    const boots = await addInventoryObject(LEVITATION_BOOTS, {
        invlet: 'd', dknown: true,
    });
    wearHeroArmor(boots);
    return boots;
}
void test('a timeout levitation over a sink crashes and ends levitation', async () => {
    sinkSpot();
    requirePlayingGame(game);
    assert.equal(game.u.levitating, true);
    const before = game.u.uhp;
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: true, died: false });
    assert.match(game._pending_message, /You crash to the floor!/);
    // CON 12: the crash costs rn1(8, 25 - 12), between 13 and 20 hit points.
    const loss = before - game.u.uhp;
    assert.ok(loss >= 13 && loss <= 20, `unexpected crash loss ${loss}`);
    assert.equal(game.u.levitating, false);
    assert.equal(game.u.levitationTurns, 0);
});
void test('innate levitation only wobbles and keeps the hero afloat', async () => {
    sinkSpot();
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'form');
    const before = game.u.uhp;
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: false, died: false });
    assert.match(game._pending_message, /You wobble unsteadily for a moment\./);
    assert.equal(game.u.uhp, before);
    assert.equal(game.u.levitating, true);
});
void test("the hero's own flight takes control instead of crashing", async () => {
    sinkSpot();
    requirePlayingGame(game);
    grantIntrinsicProperty('flying', 'outside');
    const before = game.u.uhp;
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: false, died: false });
    assert.match(game._pending_message, /You gain control of your flight\./);
    assert.equal(game.u.uhp, before);
    // Levitation is cleared even when the fall never happens.
    assert.equal(game.u.levitating, false);
    assert.equal(game.u.flying, true);
});
void test('worn levitation rings come off over a sink even while flying', async () => {
    sinkSpot();
    requirePlayingGame(game);
    grantIntrinsicProperty('flying', 'outside');
    const ring = await wearRing('uleft');
    const before = game.u.uhp;
    pushKeys(' '); // the off message pages the joined topline
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: false, died: false });
    assert.equal(game.u.uhp, before);
    assert.match(game._pending_message, /You were wearing .*ring of levitation\./);
    assert.equal(game.uleft, null);
    assert.equal(ring.worn, false);
    assert.ok(game.inventory.includes(ring));
});
void test('falling removes worn levitation rings from both hands', async () => {
    sinkSpot();
    requirePlayingGame(game);
    const left = await wearRing('uleft');
    const right = await wearRing('uright');
    pushKeys('  '); // each off message pages the joined topline
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: true, died: false });
    assert.match(game._pending_message, /You were wearing .*ring of levitation\./);
    assert.equal(game.uleft, null);
    assert.equal(game.uright, null);
    assert.equal(left.worn || right.worn, false);
    assert.equal(game.u.levitating, false);
});
void test('levitation boots come off a wobbling hero without ending levitation', async () => {
    sinkSpot();
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'form');
    const boots = await wearBoots();
    const before = game.u.uhp;
    pushKeys(' '); // the off message pages the joined topline
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: false, died: false });
    assert.equal(game.u.uhp, before);
    assert.match(game._pending_message, /You were wearing .*pair of levitation boots\./);
    assert.equal(game.uarmf, null);
    assert.equal(boots.worn, false);
    assert.equal(game.u.levitating, true);
});
void test('falling on a floor weapon hurts again', async () => {
    sinkSpot();
    requirePlayingGame(game);
    const before = game.u.uhp;
    initRng(777n);
    await fallIntoSink();
    const crashOnly = before - game.u.uhp;
    sinkSpot();
    requirePlayingGame(game);
    await floorObject(ARROW, game.u.ux, game.u.uy);
    const withWeaponBefore = game.u.uhp;
    initRng(777n); // identical rolls: only the weapon wound differs
    await fallIntoSink();
    const withWeapon = withWeaponBefore - game.u.uhp;
    assert.ok(crashOnly >= 13 && crashOnly <= 20, `crash loss ${crashOnly}`);
    assert.ok(withWeapon - crashOnly >= 1 && withWeapon - crashOnly <= 3, `weapon wound ${withWeapon - crashOnly}`);
    assert.match(game._pending_message, /You fell on .*arrow\./);
});
void test('a fatal crash discloses without levitation while items stay worn', async () => {
    sinkSpot();
    requirePlayingGame(game);
    const ring = await wearRing('uleft');
    game.u.uhp = 3;
    game.u.uhpmax = 40;
    // The world state the ending observes, captured through the die()
    // seam loseHeroHp already exposes; not a call-order assertion.
    let disclosure = null;
    const outcome = await fallIntoSink(game, {
        die: async () => {
            disclosure = {
                levitating: propertyIsActive('levitation', game),
                ringWorn: game.uleft === ring,
            };
            return true;
        },
    });
    assert.deepEqual(outcome, { fell: true, died: true });
    assert.deepEqual(disclosure, { levitating: false, ringWorn: true });
});
void test('falling with a wielded cockatrice corpse turns the hero to stone', async () => {
    sinkSpot();
    requirePlayingGame(game);
    game.uwep = await untimedCorpse(MONSTER_NAME.indexOf('cockatrice'));
    pushKeys(' ');
    let stoned = false;
    const outcome = await fallIntoSink(game, {
        die: async () => {
            stoned = true;
            return true;
        },
    });
    assert.deepEqual(outcome, { fell: true, died: true });
    assert.equal(stoned, true);
    assert.match(game._pending_message, /You turn to stone/);
});
void test('a crash interrupts donning armor and loses the partial wear', async () => {
    sinkSpot();
    requirePlayingGame(game);
    const boots = await addInventoryObject(LEVITATION_BOOTS);
    pushKeys(boots.invlet);
    await rhack('W'.charCodeAt(0));
    pushKeys(' '); // acknowledge the crash before the interrupted-dressing message
    const outcome = await fallIntoSink();
    assert.deepEqual(outcome, { fell: true, died: false });
    assert.match(game._pending_message, /You stop putting on the pair of levitation boots\./);
    assert.equal(game.multi, 0);
    assert.equal(game.uarmf, null);
    assert.equal(boots.worn, false);
});
void test('sink results survive a save and restore round trip', async () => {
    sinkSpot();
    requirePlayingGame(game);
    const ring = await wearRing('uleft');
    game.plname = 'SinkFall';
    pushKeys(' '); // the off message pages the joined topline
    await fallIntoSink();
    assert.equal(game.u.levitating, false);
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    assert.equal(game.u.levitating, false);
    assert.equal(game.uleft, null);
    // restore rebuilds object identities, so match by type and wear state
    const restored = game.inventory.find(object => object.otyp === RIN_LEVITATION);
    assert.equal(restored?.worn, false);
});
//# sourceMappingURL=sink_fall.test.js.map