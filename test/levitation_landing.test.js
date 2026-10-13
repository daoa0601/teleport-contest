import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAR_TRAP, I_SPECIAL, LAVAPOOL, PIT, POOL, TIMEOUT, TT_BEARTRAP, TT_PIT, W_SADDLE, } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroLocationEffects } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, CORPSE, HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_NAMES, } from '../js/object_data.js';
import { wearHeroAccessory, removeHeroAccessory } from '../js/accessory.js';
import { captureLevitationState, grantIntrinsicProperty, levitationIsPurelyTimed, revokeIntrinsicProperty, setPropertyTerrainBlocked, } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { floatHeroDown } from '../js/terrain_movement.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addInventoryObject, floorObject, knownObject, } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { planInput } from './support/planned-input.js';
import { createDungeon } from './support/topology.js';
const POTION_END = I_SPECIAL | TIMEOUT;
const DIAMOND = OBJECT_NAMES.indexOf('diamond');
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
// C trap.c:float_down() case LEVITATION: the timeout portion of the intrinsic
// ends the flight when nothing else holds the hero up.
void test('ending timed levitation lands the hero and picks up the floor below', async () => {
    freshObjectRoom({ gameplaySeed: 11 });
    requirePlayingGame(game);
    const gem = await floorObject(DIAMOND, 10, 10);
    game.flags.pickup = true;
    game.u.levitationTurns = 5;
    installPagerInput(resetInputState(), { expected: /You float gently to the floor|an uncursed diamond/, limit: 2 });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.equal(game.u.levitationTurns, 0);
    assert.equal(game.u.levitating, false);
    assert.match(game._pending_message, /float gently to the floor/);
    // C float_down() ends with pickup(1): autopickup runs after landing.
    assert.ok(game.inventory.includes(gem));
});
void test('a remaining levitation source keeps the hero aloft', async () => {
    freshObjectRoom({ gameplaySeed: 12 });
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    game.u.levitationTurns = 5;
    game._pending_message = '';
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 0); // C: maybe another ring/potion/boots
    assert.equal(game.u.levitating, true);
    assert.equal(game._pending_message, '');
});
// C float_down(): BLevitation == I_SPECIAL alone reports the failed hold.
void test('a bear-trap hold ends levitation without landing effects', async () => {
    freshObjectRoom({ gameplaySeed: 13 });
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'potion');
    game.u.levitationTurns = 5;
    game.u.utrap = 2;
    game.u.utraptype = TT_BEARTRAP;
    installPagerInput(resetInputState(), {
        expected: /no longer trying to float up from the trap's jaws/,
        limit: 1,
    });
    const landed = await floatHeroDown(POTION_END, 0);
    assert.equal(landed, 0);
    assert.equal(game.u.utrap, 2);
    assert.equal(game.u.utraptype, TT_BEARTRAP);
    assert.match(game._pending_message, /no longer trying to float up from the trap's jaws/);
    assert.doesNotMatch(game._pending_message, /float gently/);
});
// C float_down(): when BLevitation holds more than I_SPECIAL (terrain plus a
// floor trap) there is no end-of-levitation feedback at all.
void test('terrain- and trap-blocked levitation ends silently', async () => {
    freshObjectRoom({ gameplaySeed: 14 });
    requirePlayingGame(game);
    grantIntrinsicProperty('levitation', 'outside');
    setPropertyTerrainBlocked('levitation', true, game);
    game.u.utrap = 2;
    game.u.utraptype = TT_BEARTRAP;
    game._pending_message = '';
    const landed = await floatHeroDown(0, 0);
    assert.equal(landed, 0);
    assert.equal(game.u.utrap, 2);
    assert.equal(game._pending_message, '');
});
// C float_down(): BFlying clears and controlled flight resumes with feedback.
void test('suppressed flight resumes when levitation ends', async () => {
    freshObjectRoom({ gameplaySeed: 15 });
    requirePlayingGame(game);
    grantIntrinsicProperty('flying', 'outside');
    grantIntrinsicProperty('levitation', 'potion');
    game.u.levitationTurns = 5;
    assert.equal(game.u.flying, false);
    installPagerInput(resetInputState(), { expected: /stopped levitating and are now flying/, limit: 1 });
    const landed = await floatHeroDown(POTION_END, 0);
    assert.equal(landed, 1);
    assert.equal(game.u.flying, true);
    assert.equal(game.u.levitating, false);
    assert.match(game._pending_message, /stopped levitating and are now flying/);
});
// C float_down(): a swallowed levitator floats down inside the swallower.
void test('a swallowed levitator stays swallowed while floating down', async () => {
    freshObjectRoom({ gameplaySeed: 16 });
    requirePlayingGame(game);
    const purpleWorm = MONSTER_NAME.indexOf('purple worm');
    game.u.uswallow = 1;
    const swallower = await createMonsterAt(purpleWorm, 11, 10);
    swallower.mx = 10;
    game.u.ustuck = swallower;
    game.u.levitationTurns = 5;
    installPagerInput(resetInputState(), { expected: /float down, but you are still swallowed/, limit: 1 });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.match(game._pending_message, /still swallowed/);
});
// C float_down(): the punished hero is pulled onto a ball caught over a pit.
void test('a punished levitator lands on the ball and falls into its pit', async () => {
    freshObjectRoom({ gameplaySeed: 17 });
    requirePlayingGame(game);
    // An unseen pit cannot be avoided by C dotrap()'s known-trap roll.
    addTrap(game.level, PIT, 11, 10);
    const ball = await floorObject(HEAVY_IRON_BALL, 11, 10);
    const chain = await knownObject(IRON_CHAIN);
    chain.ox = 10;
    chain.oy = 10;
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.levitationTurns = 5;
    installPagerInput(resetInputState(), {
        expected: /iron ball|You fall into a pit|You float gently to the floor|Things that are here/,
        limit: 4,
    });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.deepEqual([chain.ox, chain.oy], [11, 10]);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok(game.u.utrap !== undefined);
    assert.ok(game.u.utrap > 0);
});
// C float_down(): Sokoban air currents knock the ending levitator over.
void test('ending levitation over a Sokoban trap knocks the hero down', async () => {
    freshObjectRoom({ gameplaySeed: 18 });
    requirePlayingGame(game);
    game.level.flags.sokoban_rules = true;
    addTrap(game.level, PIT, 10, 10, { tseen: true });
    game.u.levitationTurns = 5;
    installPagerInput(resetInputState(), { expected: /You fall over/, limit: 1 });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.match(game._pending_message, /You fall over\./);
    // losehp(rnd(2), "dangerous winds")
    assert.ok(game.u.uhp < game.u.uhpmax);
});
// C hack.c:3362-3363: the spoteffects timeout-1 deferral only applies when
// levitation is purely timed (timeout plus the potion at-will marker).
void test('levitationIsPurelyTimed matches the C no-other-source test', async () => {
    freshObjectRoom({ gameplaySeed: 24 });
    requirePlayingGame(game);
    game.u.levitationTurns = 1;
    assert.equal(levitationIsPurelyTimed(), true);
    grantIntrinsicProperty('levitation', 'potion');
    assert.equal(levitationIsPurelyTimed(), true);
    grantIntrinsicProperty('levitation', 'outside');
    assert.equal(levitationIsPurelyTimed(), false);
    revokeIntrinsicProperty('levitation', 'outside');
    revokeIntrinsicProperty('levitation', 'potion');
    const ring = await addInventoryObject(RIN_LEVITATION);
    await wearHeroAccessory(ring, 'uleft');
    assert.equal(levitationIsPurelyTimed(), false);
    await removeHeroAccessory(ring);
    game.u.levitationTurns = 0;
    assert.equal(levitationIsPurelyTimed(), false);
});
// C float_down() -> drown() can be fatal; a dead hero gets no landing
// message, trap activation, or autopickup.
void test('a drowning death ends the fall without autopickup', async () => {
    freshObjectRoom({
        gameplaySeed: 21,
        flags: { bones: false, disclose: '-i -a -v -g -c -o' },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom',
            num_dunlevs: game.u.uz.dlevel, dunlev_ureached: game.u.uz.dlevel,
        })];
    const gem = await floorObject(DIAMOND, 10, 10);
    game.flags.pickup = true;
    game.level.requireAt(10, 10).typ = POOL;
    // A faint does not wake for the crawl-out attempt, so the hero drowns.
    game._helplessTurns = 5;
    game._helplessReason = 'fainted';
    game.u.levitationTurns = 5;
    installPagerInput(resetInputState(), {
        expected: /fall into the pool of water|suddenly very wet|You drown|Drowned|points,|possessions/,
        limit: 5,
    });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.equal(!!game.program_state?.gameover, true);
    assert.ok(!game.inventory.includes(gem));
    assert.ok(floorObjectsAt(game.level, 10, 10).includes(gem), 'fatal landing must leave the uncollected gem on the floor');
});
void test('a fatal riding accident stops the Sokoban fall before self-touch', async () => {
    freshObjectRoom({
        gameplaySeed: 54,
        flags: { bones: false, disclose: '-i -a -v -g -c -o' },
    });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({
            dname: 'The Dungeons of Doom',
            num_dunlevs: game.u.uz.dlevel, dunlev_ureached: game.u.uz.dlevel,
        })];
    const pony = await createMonsterAt('pony', 11, 10);
    game.u.usteed = pony;
    game.u.uhp = 5;
    game.u.levitationTurns = 5;
    game.level.flags.sokoban_rules = true;
    addTrap(game.level, PIT, 10, 10);
    const corpse = await addInventoryObject(CORPSE, {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });
    game.uwep = game.u.uwep = corpse;
    installPagerInput(resetInputState(), {
        expected: /You fall off of the pony|You die|riding accident|points,/,
        limit: 6,
    });
    await floatHeroDown(TIMEOUT, 0);
    assert.ok(game.program_state.gameover);
    assert.doesNotMatch(game._pending_message || '', /touch the cockatrice|turn to stone/);
});
// C drown() relocation (trap.c:5151-5165 crawl-out / 5127-5136 teleport):
// every escape lands through teleds(), whose spoteffects(TRUE)
// (teleport.c:568) gives the destination its full effects, including
// auto-pickup.  This exercises the complete production owner end-to-end.
void test('a crawl-out relocation picks up the real destination floor', async () => {
    freshObjectRoom({ gameplaySeed: 51 });
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.level.requireAt(10, 10).typ = POOL;
    const wet = await floorObject(DIAMOND, 10, 10);
    const exits = [];
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10)
                exits.push({ x, y, gem: await floorObject(DIAMOND, x, y) });
        }
    }
    game.u.levitationTurns = 5;
    initRng(51002n);
    installPagerInput(resetInputState(), {
        expected: /fall into the pool of water|suddenly very wet|try to crawl out of the water|Pheew|an uncursed diamond/,
        limit: 5,
    });
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    const exit = exits.find(({ x, y }) => x === game.u.ux && y === game.u.uy);
    assert.ok(exit, 'the hero crawls to an adjacent dry square');
    assert.ok(game.inventory.includes(exit.gem));
    assert.equal(exits.filter(({ gem }) => game.inventory.includes(gem)).length, 1);
    // The pool square itself never autopicks (C pickup(): in a pool).
    assert.ok(!game.inventory.includes(wet));
});
// A controlled teleport escape drives the real destination chooser: the
// hero selects the landing square through the map cursor, and the landing
// runs the full destination effects with auto-pickup.
void test('a controlled teleport escape lands where the hero chooses', async (t) => {
    freshObjectRoom({ gameplaySeed: 52 });
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.level.requireAt(10, 10).typ = POOL;
    const gem = await floorObject(DIAMOND, 16, 10);
    game.u.levitationTurns = 5;
    game.u.teleporting = true;
    game.u.teleportControl = true;
    // teleport at will needs a seasoned hero with spell energy
    game.u.ulevel = 30;
    game.u.uen = game.u.uenmax = 200;
    game._travelTipShown = true;
    planInput(resetInputState(), t, [
        { prompt: /(?:fall into the pool of water|suddenly very wet)[\s\S]*--More--/, keys: ' ' },
        { prompt: /Where do you want to be teleported\?/, keys: 'llllll.' },
    ]);
    const landed = await floatHeroDown(TIMEOUT, 0);
    assert.equal(landed, 1);
    assert.deepEqual([game.u.ux, game.u.uy], [16, 10]);
    // the chooser-driven landing ran the full destination effects: pickup
    assert.ok(game.inventory.includes(gem));
    assert.match(game._pending_message || '', /an uncursed diamond\.$/);
});
// C lava_effects() life-saving rescue (trap.c:6927-6961): safe_teleds runs
// while in_lava_effects still suppresses its spoteffects, then the explicit
// post-decrement spoteffects(FALSE) lands the rescued hero with auto-pickup
// suppressed.  Observable: the hero survives on dry land, but the floor
// under the landing stays unpicked.
void test('a lava rescue triggers the landing trap without auto-pickup', async () => {
    freshObjectRoom({
        gameplaySeed: 53, left: 11, right: 11, top: 10, bottom: 10,
    });
    requirePlayingGame(game);
    game.flags.pickup = true;
    game.level.requireAt(10, 10).typ = LAVAPOOL;
    const gem = await floorObject(DIAMOND, 11, 10);
    addTrap(game.level, BEAR_TRAP, 11, 10);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    installPagerInput(resetInputState(), {
        expected: /amulet of life saving|molten lava|burn to a crisp|But wait|medallion|feel much better|still burning|bear trap/, limit: 10,
    });
    await applyHeroLocationEffects();
    assert.ok(!game.program_state?.gameover);
    assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
    assert.ok(!game.inventory.includes(amulet));
    assert.equal(game.u.utraptype, TT_BEARTRAP);
    assert.ok(game.u.utrap !== undefined);
    assert.ok(game.u.utrap > 0);
    assert.ok(floorObjectsAt(game.level, 11, 10).includes(gem));
    assert.ok(!game.inventory.includes(gem));
});
// C float_down(0, W_SADDLE) from dismount_steed(): the saddle bit suppresses
// the landing message, not the landing itself.  Equipment setters pass the
// pre-removal snapshot through `previous`.
void test('a dismount landing suppresses the message but not the pickup', async () => {
    freshObjectRoom({ gameplaySeed: 19 });
    requirePlayingGame(game);
    const gem = await floorObject(DIAMOND, 10, 10);
    game.flags.pickup = true;
    grantIntrinsicProperty('levitation', 'outside');
    const previous = captureLevitationState();
    revokeIntrinsicProperty('levitation', 'outside');
    installPagerInput(resetInputState(), { expected: /an uncursed diamond/, limit: 1 });
    const landed = await floatHeroDown(0, W_SADDLE, game, previous);
    assert.equal(landed, 1);
    assert.equal(game.u.levitating, false);
    assert.doesNotMatch(game._pending_message || '', /float gently/);
    assert.ok(game.inventory.includes(gem));
});
//# sourceMappingURL=levitation_landing.test.js.map