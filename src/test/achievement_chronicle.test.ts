// C insight.c:record_achievement(): every newly recorded achievement appends
// its achieve_msg[] line to the chronicle (livelog_printf -> gamelog_add) at
// the current turn, except during final disclosure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLogEvents } from '../js/gamelog.js';
import { achievementEntries, recordDungeonEntryAchievements } from '../js/achievements.js';
import { recordHeroPrizeAcquisition } from '../js/hero_inventory.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { createMonsterAt } from './support/monsters.js';
import { ACH_BGRM, ACH_MEDU, ACH_SOKO } from '../js/const.js';
import { LUCKSTONE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { checkSpecialRoom } from '../js/shk.js';
import { requireFixtureGame } from './support/game-state.js';

void test('entering a staffed shop chronicles the shop achievement', async () => {
    freshObjectRoom({ left: 3, right: 28, top: 3, bottom: 17 });
    requireFixtureGame(game);
    game.plname = 'Ada';
    resetInputState();
    await createStaffedShop({ left: 9, right: 13, top: 8, bottom: 12, keeperX: 12 });
    const turn = game.moves;

    game.u.ushops_entered = [...game.u.ushops];
    game.u.ushops = [];
    game.u.ux0 = game.u.ux;
    game.u.uy0 = game.u.uy;
    await checkSpecialRoom();

    const events = gameLogEvents();
    assert.ok(events.some(entry => entry.turn === turn && entry.text === 'entered a shop'),
        `chronicle must hold the shop entry: ${JSON.stringify(events)}`);
    // record_achievement() does not duplicate a repeated achievement
    assert.equal(events.filter(entry => entry.text === 'entered a shop').length, 1);
});

// do.c:1908-1916: entering the Sokoban branch for the first time records
// ACH_SOKO, whose achieve_msg[] line is "entered Sokoban".
void test('arriving in the Sokoban branch chronicles the branch entry', () => {
    freshObjectRoom();
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom' }),
        createDungeon({ dname: 'Sokoban' }),
    ];
    game.sokoban_dnum = 1;
    game.u.uachieved = [];
    game.gamelog = [];
    const turn = game.moves;

    recordDungeonEntryAchievements(game,
        { dnum: 0, dlevel: 1 }, { dnum: 1, dlevel: 1 });

    assert.ok(achievementEntries(game).includes(ACH_SOKO));
    assert.deepEqual(gameLogEvents().at(-1),
        { turn, text: 'entered Sokoban' });
});

// do.c:1693-1700, 1915: the Bigroom achievement needs a newly made level
// (`new`), not just a branch change; a cached revisit records nothing.
void test('arriving on a new Bigroom level chronicles it, a revisit does not', () => {
    freshObjectRoom();
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' })];
    game.specialLevels = new Map([
        ['bigrm', createSpecialLevel({ dnum: 0, dlevel: 5 })],
    ]);
    game.u.uachieved = [];
    game.gamelog = [];
    const turn = game.moves;

    recordDungeonEntryAchievements(game,
        { dnum: 0, dlevel: 1 }, { dnum: 0, dlevel: 5 }, { newLevel: true });
    assert.deepEqual(gameLogEvents().at(-1),
        { turn, text: 'entered the Bigroom' });

    game.u.uachieved = [];
    game.gamelog = [];
    recordDungeonEntryAchievements(game,
        { dnum: 0, dlevel: 1 }, { dnum: 0, dlevel: 5 }, { newLevel: false });
    assert.deepEqual(gameLogEvents(), [],
        'returning to the cached Bigroom level records no second entry');
    assert.equal(achievementEntries(game).includes(ACH_BGRM), false);
});

// mon.c:3001: Medusa's first death this game logs the "killed Medusa"
// achievement line.
void test('the first Medusa death chronicles the kill', async () => {
    freshObjectRoom();
    resetInputState();
    const medusa = await createMonsterAt('Medusa', 11, 10);
    const turn = game.moves;

    await finishHeroMonsterKill(medusa, 11, 10);

    assert.ok(achievementEntries(game).includes(ACH_MEDU));
    assert.ok(gameLogEvents().some(entry => entry.turn === turn
        && entry.text === 'killed Medusa'),
        `chronicle must hold the Medusa kill: ${JSON.stringify(gameLogEvents())}`);
});

// The prize chronicle line appends the recorded prize type; achieveo losing
// that type is an invariant violation, not a silently missing line.
void test('a level prize without its recorded type fails loudly', async () => {
    freshObjectRoom();
    const prize = await floorObject(LUCKSTONE, 11, 10);
    prize.o_id = 77;
    prize.nomerge = true;
    game.context.achieveo = { mines_prize_oid: 77 };

    assert.throws(() => recordHeroPrizeAcquisition(prize, game),
        /level prize needs its original object type/);
    assert.deepEqual(gameLogEvents().filter(entry =>
        entry.text.startsWith('acquired')), [],
        'no prize line is logged without the type');
});
