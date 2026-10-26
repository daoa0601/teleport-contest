import { monsterAtPosition } from '../js/monster_location.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import type { GameObject } from '../js/object_types.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACH_INVK, ACH_NOVL } from '../js/achievements.js';
import { FIRE_TRAP, MOAT, NO_MINVENT, ROOM, STAIRS, VIBRATING_SQUARE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { level_difficulty } from '../js/dungeon.js';
import { installPagerInput } from './support/pager-input.js';
import { maketrap } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { novelTitle, NOVEL_TITLES } from '../js/novel_titles.js';
import {
    BELL_OF_OPENING, BOULDER, CANDELABRUM_OF_INVOCATION, CORPSE, EGG,
    SPE_NOVEL, ROCK, SPE_BOOK_OF_THE_DEAD,
} from '../js/object_data.js';
import { readBookOfDead, readNovel } from '../js/special_spellbooks.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTimers, OBJECT_TIMER_KIND, stopAllObjectTimers } from '../js/object_timers.js';
import { runDueTimers } from '../js/timer_effects.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { addShopObjectToBill } from '../js/shk.js';
import { createStaffedShop } from './support/shop.js';

async function readDead(book: GameObject) {
    requirePlayingGame(game);
    // Invocation has four announcement phases. Native raising adds up to five
    // undead plus its difficulty bonus and an optional lich; every affected
    // actor or carried corpse can announce arrival, reaction, and death/revival.
    const raisedLimit = 6 + Math.trunc((level_difficulty() + 1) / 10);
    installPagerInput(resetInputState(), {
        expected: new RegExp([
            /Book of the Dead|ancestors are annoyed|headstones in the cemetery|name appears in the book/.source,
            /runes appear scrambled|Book seems to be ignoring|A chill runs down|faint chime/.source,
            /doppelganger is amused|invocation fails|relics is cursed|something is amiss/.source,
            /raised the dead|floor shakes violently|walls around you|stairwell leading down/.source,
            /suddenly reanimates|suddenly appears next to you/.source,
            /\b(?:zombie|ghost|orc|chickatrice|egg|boulder)\b/.source,
        ].join('|')),
        limit: 4 + 3 * (game.level.monsters.length + game.inventory.length + raisedLimit),
    });
    return await readBookOfDead(book);
}

async function invocationBook() {
    freshObjectRoom({ left: 6, right: 26, top: 3, bottom: 19, heroX: 16, heroY: 11,
        hero: { uz: { dnum: 0, dlevel: 8 } }, gameplaySeed: 12n });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',  num_dunlevs: 9, depth_start: 1, flags: { hellish: true } })];
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    await maketrap(16, 11, VIBRATING_SQUARE);
    return await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false });
}

async function preparedRelics() {
    requirePlayingGame(game);
    const bell = await addInventoryObject(BELL_OF_OPENING, { initialize: false, age: game.moves - 4 });
    const candles = await addInventoryObject(CANDELABRUM_OF_INVOCATION, { initialize: false, spe: 7, lamplit: true });
    game.u.uhave.bell = game.u.uhave.menorah = true;
    return { bell, candles };
}

void test('the Dead Book identifies itself without consuming the actual book', async () => {
    freshObjectRoom({ hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, known: false, dknown: false });
    await readDead(book);
    assert.equal(book.known, true);
    assert.equal(book.dknown, true);
    assert.ok(game._knownObjectTypes !== undefined && game._knownObjectTypes !== null, 'Expected game._knownObjectTypes to be initialized');
    assert.equal(game._knownObjectTypes?.has(book.otyp), true);
    assert.equal(game.inventory.includes(book), true);
    assert.equal(book.spestudied ?? 0, 0);
});

void test('blessed reading pacifies visible undead and makes distant enemies flee', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    const nearby = await createMonsterAt(MONSTER_NAME.indexOf('ghost'), 11, 10, NO_MINVENT);
    const distant = await createMonsterAt(MONSTER_NAME.indexOf('human zombie'), 15, 10, NO_MINVENT);
    const living = await createMonsterAt(MONSTER_NAME.indexOf('orc'), 13, 11, NO_MINVENT);
    living.mpeaceful = 0;
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, blessed: true });
    await readDead(book);
    assert.equal(nearby.mpeaceful, 1);
    assert.ok(nearby.mtame !== undefined && nearby.mtame !== null, 'Expected nearby.mtame to be initialized');
    assert.ok(nearby.mtame > 0);
    assert.equal(distant.mpeaceful, 1);
    assert.equal(distant.mflee, 1);
    assert.equal(living.mpeaceful, 0);
});

void test('blessed reading increases an existing pet undead to the native limit', async () => {
    freshObjectRoom({ hero: { ualign: { type: -1, record: 0 } } });
    requirePlayingGame(game);
    const ghost = await createMonsterAt(MONSTER_NAME.indexOf('ghost'), 11, 10, NO_MINVENT);
    ghost.mtame = 19;
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, blessed: true });
    await readDead(book);
    assert.equal(ghost.mtame, 20);
    await readDead(book);
    assert.equal(ghost.mtame, 20);
});

void test('blessed reading does not pacify unseen undead through a wall', async () => {
    freshObjectRoom({ hero: { blindTurns: 20 } });
    requirePlayingGame(game);
    const ghost = await createMonsterAt(MONSTER_NAME.indexOf('ghost'), 11, 10, NO_MINVENT);
    ghost.mpeaceful = 0;
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, blessed: true });
    await readDead(book);
    assert.equal(ghost.mpeaceful, 0);
});

void test('cursed reading revives a carried corpse and creates a real undead swarm', async () => {
    freshObjectRoom({ left: 5, right: 20, top: 4, bottom: 17, gameplaySeed: 9n });
    requirePlayingGame(game);
    const corpse = await addInventoryObject(CORPSE, { initialize: false, corpsenm: MONSTER_NAME.indexOf('human zombie'), norevive: true });
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, cursed: true });
    await readDead(book);
    assert.equal(game.inventory.includes(corpse), false);
    assert.ok(game.level.monsters.some(monster => monster.mrevived));
    assert.ok(game.level.monsters.length > 1);
    assert.equal(game.level.flags.graveyard, true);
});

void test('missing invocation relics do not raise the dead or change the level', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    await readDead(book);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.level.requireAt(16, 11).typ, ROOM);
    assert.equal(game.u.uevent?.invoked, undefined);
});

void test('a cursed Dead Book at the invocation square refuses the invocation', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    await preparedRelics();
    book.cursed = true;
    await readDead(book);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.uevent?.invoked, undefined);
    assert.match(game._pending_message, /scrambled/);
});

void test('a prepared cursed relic fails without summoning undead', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    const { bell } = await preparedRelics();
    bell.cursed = true;
    await readDead(book);
    assert.equal(game.level.monsters.length, 0);
    assert.equal(game.u.uevent?.invoked, undefined);
    assert.match(game._pending_message, /relics is cursed/);
});

void test('a stale bell raises the dead instead of invoking', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    const { bell } = await preparedRelics();
    bell.age = game.moves - 5;
    await readDead(book);
    assert.ok(game.level.monsters.length > 0);
    assert.equal(game.level.flags.graveyard, true);
    assert.equal(game.u.uevent?.invoked, undefined);
});

void test('successful invocation changes real terrain, traps, boulders, stairs and achievements', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    await preparedRelics();
    const crushed = await floorObject(BOULDER, 16, 12, { initialize: false });
    const fractured = await floorObject(BOULDER, 16, 13, { initialize: false });
    game.u.utrap = 5;
    game.u.utraptype = 1;
    await readDead(book);
    assert.equal(game.level.requireAt(16, 11).typ, STAIRS);
    assert.ok(game.level.dnstair !== undefined && game.level.dnstair !== null, 'Expected game.level.dnstair to be initialized');
    assert.equal(game.level.dnstair.x, 16);
    assert.ok(game.stairs !== undefined && game.stairs !== null, 'Expected game.stairs to be initialized');
    assert.equal(game.stairs.tolev.dlevel, 9);
    assert.equal(game.level.requireAt(16, 12).typ, ROOM);
    assert.ok(game.level.traps.some(trap => trap.tx === 16 && trap.ty === 12 && trap.ttyp === FIRE_TRAP && trap.tseen));
    assert.equal(game.level.requireAt(20, 11).typ, MOAT);
    assert.equal(crushed.where, 'gone');
    assert.equal(fractured.otyp, ROCK);
    assert.equal(game.u.utrap, 0);
    assert.ok(game.u.uevent !== undefined && game.u.uevent !== null, 'Expected game.u.uevent to be initialized');
    assert.equal(game.u.uevent.invoked, 1);
    assert.equal(game.u.uevent.udemigod, 1);
    assert.ok(game.u.udg_cnt !== undefined && game.u.udg_cnt !== null, 'Expected game.u.udg_cnt to be initialized');
    assert.ok(game.u.udg_cnt >= 2 && game.u.udg_cnt <= 12);
    assert.ok(game.u.uachieved !== undefined && game.u.uachieved !== null, 'Expected game.u.uachieved to be initialized');
    assert.ok(game.u.uachieved.includes(ACH_INVK));
    assert.equal(game.inventory.includes(book), true);
});

void test('novel generation retains its canonical title as actual object identity', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_NOVEL, { initialize: false });
    assert.ok(book.oextra !== undefined && book.oextra !== null, 'Expected book.oextra to be initialized');
    assert.ok(book.novelidx !== undefined);
    assert.equal(book.oextra.oname, NOVEL_TITLES[book.novelidx]);
    assert.equal(novelTitle(book), book.oextra.oname);
});

void test('reading a novel waits for its tribute page before conduct and one-time experience', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_NOVEL, { initialize: false, novelidx: 0 });
    const input = resetInputState();
    const reading = readNovel(book);
    await input.waitUntilBlocked();
    assert.equal(game.u.uconduct.literate ?? 0, 0);
    assert.equal(game.u.uexp ?? 0, 0);
    input.feed('\x1b');
    await reading;
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(game.u.uexp, 20);
    assert.equal(game.u.urexp, 80);
    assert.ok(game.u.uachieved !== undefined && game.u.uachieved !== null, 'Expected game.u.uachieved to be initialized');
    assert.ok(game.u.uachieved.includes(ACH_NOVL));
    assert.equal(game.inventory.includes(book), true);
    input.feed('\x1b');
    await readNovel(book);
    assert.equal(game.u.uconduct.literate, 2);
    assert.equal(game.u.uexp, 20);
});

void test('repeated reading exhausts each passage once before restarting the same novel', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const book = await addInventoryObject(SPE_NOVEL, { initialize: false, novelidx: 0 });
    const passages = new Set();
    for (let read = 0; read < 14; read++) {
        resetInputState().feed('\x1b');
        await readNovel(book);
        passages.add(game._toplines);
    }
    assert.equal(passages.size, 14);
    resetInputState().feed('\x1b');
    await readNovel(book);
    assert.ok(passages.has(game._toplines));
});

void test('a different copy of the same novel gets its own unread passage pool', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const first = await addInventoryObject(SPE_NOVEL, { initialize: false, novelidx: 0 });
    const second = await addInventoryObject(SPE_NOVEL, { initialize: false, novelidx: 0 });
    assert.notEqual(first.o_id, second.o_id);
    for (let read = 0; read < 13; read++) {
        resetInputState().feed('\x1b');
        await readNovel(first);
    }
    const passages = new Set();
    for (let read = 0; read < 14; read++) {
        resetInputState().feed('\x1b');
        await readNovel(second);
        passages.add(game._toplines);
    }
    assert.equal(passages.size, 14);
});

void test('invocation exposes existing monsters to newly created fire and moat', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    await preparedRelics();
    const burned = await createMonsterAt('human zombie', 17, 11, NO_MINVENT);
    burned.mhp = burned.mhpmax = 500;
    const drowned = await createMonsterAt('orc', 20, 11, NO_MINVENT);
    await readDead(book);
    assert.ok(burned.mhp < 500);
    assert.equal(drowned.dead, true);
    assert.notEqual(monsterAtPosition(game.level, drowned.mx, drowned.my), drowned);
});

void test('blind invocation creates the Sanctum stairs and retains an earlier intervention', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    await preparedRelics();
    setHeroBlindnessTurns(20);
    vision_recalc(0);
    game.u.udg_cnt = 1;
    await readDead(book);
    assert.equal(game.level.requireAt(16, 11).typ, STAIRS);
    assert.ok(game.u.uevent !== undefined && game.u.uevent !== null, 'Expected game.u.uevent to be initialized');
    assert.equal(game.u.uevent.invoked, 1);
    assert.equal(game.u.udg_cnt, 1);
});

void test('unlit seven-candle relics summon undead rather than opening the Sanctum', async () => {
    const book = await invocationBook();
    requirePlayingGame(game);
    const { candles } = await preparedRelics();
    candles.lamplit = false;
    await readDead(book);
    assert.ok(game.level.monsters.length > 0);
    assert.equal(game.level.requireAt(16, 11).typ, ROOM);
    assert.equal(game.u.uevent?.invoked, undefined);
});

void test('cursed reading restarts viable carried egg hatching', async () => {
    freshObjectRoom({ gameplaySeed: 6n });
    requirePlayingGame(game);
    const egg = await addInventoryObject(EGG, { initialize: false, corpsenm: MONSTER_NAME.indexOf('chickatrice') });
    stopAllObjectTimers(egg);
    const book = await addInventoryObject(SPE_BOOK_OF_THE_DEAD, { initialize: false, cursed: true });
    await readDead(book);
    const hatch = objectTimers(egg).find(timer => timer.kind === OBJECT_TIMER_KIND.HATCH_EGG);
    assert.ok(hatch);
    assert.ok(hatch.deadline > game.moves);
    assert.equal(game.inventory.includes(egg), true);
    game.moves = hatch.deadline;
    await runDueTimers();
    assert.ok(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('chickatrice')));
});

void test('reading an unpaid novel adds a usage fee without removing it from its bill', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    const book = await addInventoryObject(SPE_NOVEL, { initialize: false, novelidx: 0 });
    await addShopObjectToBill(book);
    const input = resetInputState();
    input.feed('\x1b');
    installPagerInput(input, {
        expected: /no free library|You owe.*zorkmid/,
        limit: 1,
    });
    await readNovel(book);
    assert.ok(shopkeeper.eshk.debit > 0);
    assert.equal(book.unpaid, true);
    assert.equal(game.inventory.includes(book), true);
});
