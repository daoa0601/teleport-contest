import { createRoom } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, CORR, FAINTED, FAINTING, HUNGRY, NOT_HUNGRY, POOL, ROOMOFFSET, SATIATED, STARVED, VAULT, VWALL, WEAK, } from '../js/const.js';
import { currentAttribute } from '../js/attrib.js';
import { moveloop_core } from '../js/allmain.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { _statusLine2, clearMessageWindow, pline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { gainHeroNutrition, getHungry, resetHeroFaint, spendHeroNutrition, } from '../js/hunger.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AMULET_OF_LIFE_SAVING, APPLE, FOOD_RATION, HEAVY_IRON_BALL, LEATHER_GLOVES, OBJECT_NAMES, } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { inventoryWeight, weightCapacity } from '../js/weight.js';
import { startRun } from '../js/runmode.js';
import { restoreGame, saveGame } from '../js/save.js';
import { loadScoreRecords } from '../js/score_records.js';
import { continueVaultGuardArrival, maintainVaultResidence } from '../js/vault.js';
import { addInventoryObject, corpseObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { installPagerInput } from './support/pager-input.js';
function acknowledgeMessages() {
    const input = resetInputState();
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads < 80, 'hunger action requested too many acknowledgments');
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (/Do you want (?:your possessions identified|to see your attributes|an account of creatures vanquished|to see your conduct|to see the dungeon overview)\?/.test(screen)) {
                return 'n'.charCodeAt(0);
            }
            assert.match(screen, /--More--|\(end\)/, 'unexpected hunger input prompt');
            return ' '.charCodeAt(0);
        },
    };
    return input;
}
void test('spending nutrition reaches Hungry and ends running', async () => {
    freshObjectRoom({ hero: { uhunger: 151, uhs: NOT_HUNGRY } });
    requireFixtureGame(game);
    startRun(1, 0);
    await spendHeroNutrition(1);
    assert.equal(game.u.uhs, HUNGRY);
    assert.equal(game._runState, null);
    assert.match(game._lastPlineMessage, /beginning to feel hungry/);
});
void test('hunger temporarily weakens Strength even through sustain ability', async () => {
    freshObjectRoom({ hero: { uhunger: 51, uhs: HUNGRY } });
    requireFixtureGame(game);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('sustain ability'));
    await wearHeroAccessory(ring, 'uleft');
    const strength = currentAttribute(A_STR);
    const innateStrength = game.u.acurr.a[A_STR];
    await spendHeroNutrition(1);
    assert.equal(game.u.uhs, WEAK);
    assert.equal(currentAttribute(A_STR), strength - 1);
    assert.equal(game.u.acurr.a[A_STR], innateStrength);
    await gainHeroNutrition(100);
    assert.equal(game.u.uhs, HUNGRY);
    assert.equal(currentAttribute(A_STR), strength);
    assert.match(game._lastPlineMessage, /only feel hungry now/);
});
void test('zero nutrition expenditure still checks the current hunger state', async () => {
    freshObjectRoom({ hero: { uhunger: 150, uhs: NOT_HUNGRY } });
    requireFixtureGame(game);
    await spendHeroNutrition(0);
    assert.equal(game.u.uhunger, 150);
    assert.equal(game.u.uhs, HUNGRY);
    assert.match(game._lastPlineMessage, /beginning to feel hungry/);
});
void test('fainting from hunger makes the hero temporarily deaf and unable to act', async () => {
    freshObjectRoom({ hero: { uhunger: 1, uhs: WEAK } });
    requireFixtureGame(game);
    await spendHeroNutrition(1);
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(game.deaf, true);
    assert.equal(game.u.deafTurns, 10);
    assert.equal(game._helplessTurns, 10);
    assert.match(_statusLine2(), /Fainted.*Deaf/);
});
void test('hunger does not replace an existing involuntary delay', async () => {
    freshObjectRoom({ hero: { uhunger: 1, uhs: WEAK } });
    requireFixtureGame(game);
    game._helplessTurns = 20;
    game._helplessReason = 'paralyzed';
    await spendHeroNutrition(1);
    assert.equal(game._helplessTurns, 20);
    assert.equal(game._helplessReason, 'paralyzed');
    assert.equal(game.u.uhs, FAINTING);
    assert.equal(!!game.deaf, false);
});
void test('ordinary turn metabolism owns the Hungry transition', async () => {
    freshObjectRoom({ hero: { uhunger: 151, uhs: NOT_HUNGRY } });
    requireFixtureGame(game);
    await getHungry();
    assert.equal(game.u.uhs, HUNGRY);
    assert.match(game._lastPlineMessage, /beginning to feel hungry/);
});
void test('a complete meal suppresses intermediate hunger recovery messages', async () => {
    freshObjectRoom({ hero: {
            uhunger: 1, uhs: WEAK, atemp: { a: [-1, 0, 0, 0, 0, 0] },
        } });
    requireFixtureGame(game);
    const food = await addInventoryObject(FOOD_RATION, { age: game.moves });
    const input = acknowledgeMessages();
    assert.ok(food.invlet);
    input.feed(food.invlet);
    const strength = game.u.acurr.a[A_STR];
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.atemp.a[A_STR], -1);
    for (let bite = 0; game._occupation && bite < 10; bite++)
        await continueCountedCommand();
    assert.equal(game._occupation, null);
    assert.equal(game.u.uhs, NOT_HUNGRY);
    assert.equal(currentAttribute(A_STR), strength);
    assert.doesNotMatch(game._pending_message || '', /only feel hungry now/);
    assert.equal(game.inventory.includes(food), false);
});
void test('a meal ending Hungry reports recovery only after its final bite', async () => {
    freshObjectRoom({ hero: {
            uhunger: 30, uhs: WEAK, atemp: { a: [-1, 0, 0, 0, 0, 0] },
        } });
    requireFixtureGame(game);
    const apple = await addInventoryObject(APPLE, { age: game.moves });
    const input = acknowledgeMessages();
    assert.ok(apple.invlet);
    input.feed(apple.invlet);
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.uhs, HUNGRY);
    assert.match(game._lastPlineMessage, /only feel hungry now/);
    assert.equal(game.u.atemp.a[A_STR], 0);
});
void test('nutrition gained outside a meal warns about fullness and takes two turns', async () => {
    freshObjectRoom({ hero: { uhunger: 1490, uhs: SATIATED } });
    requireFixtureGame(game);
    await gainHeroNutrition(10);
    assert.match(game._lastPlineMessage, /hard time getting all of it down/);
    assert.equal(game._helplessTurns, 2);
    assert.equal(game._helplessDoneMessage, "You're finally finished.");
});
void test('an initially full eater can decline more bites when the fullness warning appears', async () => {
    freshObjectRoom({ hero: { uhunger: 1450, uhs: SATIATED } });
    requireFixtureGame(game);
    const food = await addInventoryObject(FOOD_RATION, { age: game.moves });
    const input = acknowledgeMessages();
    assert.ok(food.invlet);
    input.feed(food.invlet);
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('--More--'))
            input.feed(' ');
        else if ((game._pending_message || '').includes('Continue eating?'))
            input.feed('n');
    };
    await rhack('e'.charCodeAt(0));
    await continueCountedCommand();
    assert.equal(game._occupation, null);
    assert.equal(game.inventory.includes(food), true);
    assert.ok(food.oeaten != null);
    assert.ok(food.oeaten > 0);
    assert.match(game._lastPlineMessage, /stop eating/);
});
void test('rotten food keeps its pre-meal weight until the meal records it', async () => {
    freshObjectRoom({ hero: { uhunger: 1450, uhs: SATIATED } });
    requireFixtureGame(game);
    initRng(1n);
    // Cursed food is rotten; its first bite halves the remaining nutrition.
    const food = await addInventoryObject(FOOD_RATION, { age: game.moves, cursed: true });
    // A fixed-weight load leaves the hero two units over capacity.
    await addInventoryObject(HEAVY_IRON_BALL, { owt: weightCapacity(game) - inventoryWeight(game) + 2 });
    const input = acknowledgeMessages();
    assert.ok(food.invlet);
    input.feed(food.invlet);
    let statusAtPrompt = '';
    input.beforeRead = () => {
        const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        if (screen.includes('--More--'))
            input.feed(' ');
        else if ((game._pending_message || '').includes('Continue eating?')) {
            statusAtPrompt = _statusLine2();
            input.feed('n');
        }
    };
    await rhack('e'.charCodeAt(0));
    await continueCountedCommand();
    assert.match(statusAtPrompt, /Burdened/);
    assert.doesNotMatch(_statusLine2(), /Burdened/);
});
void test('a breathless hero survives choking through the shared vomiting owner', async () => {
    freshObjectRoom({ hero: { uhunger: 1999, uhs: SATIATED } });
    requireFixtureGame(game);
    acknowledgeMessages();
    await polymonHero(MONSTER_NAME.indexOf('iron golem'));
    await gainHeroNutrition(1);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.uhunger, 1000);
    assert.equal(game._helplessReason, 'vomiting');
});
void test('starvation uses the ordinary final death path', async () => {
    freshObjectRoom({ hero: { uhunger: -221, uhs: FAINTING } });
    requireFixtureGame(game);
    game.storage = memoryStorage();
    acknowledgeMessages();
    initRng(2n);
    await spendHeroNutrition(1);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.uhs, STARVED);
    assert.equal(game.u.uhp, 0);
    assert.equal(game._deathKiller, 'starvation');
});
void test('choking life saving resets nutrition even when the hero is overfull', async () => {
    freshObjectRoom({ hero: { uhunger: 1999, uhs: SATIATED, strangledTurns: 6 } });
    requireFixtureGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING);
    await wearHeroAccessory(amulet, 'uamul');
    acknowledgeMessages();
    await gainHeroNutrition(1);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.uhunger, 900);
    assert.equal(game.u.uhs, NOT_HUNGRY);
    assert.ok(game.u.uhp > 0);
    assert.equal(amulet.where, 'gone');
});
void test('a fully conscious human can die from choking through ordinary death disclosure', async () => {
    freshObjectRoom({ hero: { uhunger: 1999, uhs: SATIATED, strangledTurns: 6 } });
    requireFixtureGame(game);
    game.storage = memoryStorage();
    acknowledgeMessages();
    await gainHeroNutrition(1);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game._deathKiller, 'a quick snack');
    assert.equal(game.u.uhunger, 2000);
});
void test('premature revival ends a faint without ending another involuntary delay', async () => {
    freshObjectRoom({ hero: { uhunger: 1, uhs: WEAK } });
    requireFixtureGame(game);
    acknowledgeMessages();
    await spendHeroNutrition(1);
    assert.equal(await resetHeroFaint(), true);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game.u.uhs, FAINTING);
    assert.match(game._lastPlineMessage, /You revive/);
    game._helplessTurns = 12;
    game._helplessReason = 'paralyzed';
    assert.equal(await resetHeroFaint(), false);
    assert.equal(game._helplessTurns, 12);
});
void test('fainting onto a wielded cockatrice corpse petrifies even through gloves', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uhunger: 1, uhs: WEAK } });
    requireFixtureGame(game);
    game.storage = memoryStorage();
    game.u.urexp = 100;
    game.iflags.toptenwin = false;
    const corpse = await corpseObject(MONSTER_NAME.indexOf('cockatrice'));
    corpse.where = 'inventory';
    game.inventory.push(corpse);
    game.uwep = corpse;
    game.uarmg = await addInventoryObject(LEATHER_GLOVES);
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        if (game._pending_message)
            messages.push(game._pending_message);
    };
    installPagerInput(input, { expected: /stone|touch|faint|Goodbye|points|You were/i, limit: 10 });
    await spendHeroNutrition(1);
    assert.ok(game.program_state.gameover, 'falling while wielding the corpse must be fatal');
    assert.ok(messages.join(' ').includes('Falling, you touch the cockatrice corpse.'), messages.join(' | '));
    assert.equal(loadScoreRecords()[0]?.death, 'petrified by a cockatrice corpse, while fainted from lack of food');
});
void test('restore keeps fainting hunger, deafness, and weakness but loses the recovery callback', async () => {
    freshObjectRoom({ hero: { uhunger: 51, uhs: HUNGRY } });
    requireFixtureGame(game);
    acknowledgeMessages();
    await spendHeroNutrition(51);
    const strength = currentAttribute(A_STR);
    game.plname = 'SavedFaint';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('SavedFaint', storage), true);
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(game.u.deafTurns, 10);
    assert.equal(currentAttribute(A_STR), strength);
    acknowledgeMessages();
    clearMessageWindow();
    assert.equal(await resetHeroFaint(), false);
    assert.equal(game.u.uhs, FAINTED);
    assert.equal(game.u.deafTurns, 10);
    assert.equal(game._pending_message, '');
});
void test('falling into water revives a fainted hero before crawling out', async () => {
    const level = freshObjectRoom({ hero: { uhunger: 1, uhs: WEAK } });
    requireFixtureGame(game);
    acknowledgeMessages();
    await spendHeroNutrition(1);
    level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    const result = await heroLiquidEffects();
    assert.ok(result !== null && result !== undefined);
    assert.equal(result.moved, true);
    assert.equal(game._helplessTurns, 0);
    assert.equal(game.u.uhs, FAINTING);
    assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, POOL);
    assert.equal(!!game.program_state.gameover, false);
});
void test('a real vault guard revives the fainted hero before asking for a name', async () => {
    const level = freshObjectRoom({
        left: 9, right: 10, top: 9, bottom: 10,
        hero: { uhunger: 1, uhs: WEAK },
    });
    requireFixtureGame(game);
    level.rooms.push(createRoom({ lx: 9, hx: 10, ly: 9, hy: 10, rtype: VAULT }));
    for (let x = 9; x <= 10; x++)
        for (let y = 9; y <= 10; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    level.requireAt(16, 10).typ = CORR;
    level.requireAt(11, 10).typ = VWALL;
    game.u.uinvault = 29;
    await spendHeroNutrition(1);
    const input = acknowledgeMessages();
    let hungerDuringName;
    let answeredName = false;
    input.beforeRead = () => {
        if ((game._pending_message || '').includes('who are you')) {
            if (answeredName)
                return;
            answeredName = true;
            hungerDuringName = game.u.uhs;
            input.feed('TestHero\n');
        }
        else {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /--More--/);
            input.feed(' ');
        }
    };
    assert.equal(maintainVaultResidence(), true);
    await continueVaultGuardArrival();
    assert.equal(hungerDuringName, FAINTING);
    assert.equal(game._helplessTurns, 0);
    assert.ok(level.monsters.some(monster => monster.isgd));
});
void test('the real moveloop waits for recovery prose before unfaint changes the state', async () => {
    freshObjectRoom({ hero: { uhunger: 1, uhs: WEAK, umovement: 0 } });
    requireFixtureGame(game);
    await spendHeroNutrition(1);
    game._moveloopStarted = true;
    game._heroTimePending = true;
    game.context.move = 1;
    const input = acknowledgeMessages();
    for (let turn = 0; turn < 9; turn++)
        await moveloop_core();
    assert.equal(game._helplessTurns, 1);
    await pline('An earlier message fills the line before you regain consciousness.');
    let atRecovery;
    input.beforeRead = () => {
        if (game.u.uhs === FAINTED) {
            atRecovery = game.u.uhs;
            input.feed(' ');
        }
        else
            input.feed('\x1b');
    };
    await moveloop_core();
    assert.equal(atRecovery, FAINTED);
    assert.equal(game.u.uhs, FAINTING);
    assert.equal(game._helplessTurns, 0);
    assert.match(game._lastPlineMessage, /regain consciousness/);
});
//# sourceMappingURL=hunger_transitions.test.js.map