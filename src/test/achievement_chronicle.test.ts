// C insight.c:record_achievement(): every newly recorded achievement appends
// its achieve_msg[] line to the chronicle (livelog_printf -> gamelog_add) at
// the current turn, except during final disclosure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLogEvents } from '../js/gamelog.js';
import { achievementEntries, recordDungeonEntryAchievements } from '../js/achievements.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { resetInputState } from '../js/input.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { createMonsterAt } from './support/monsters.js';
import { ACH_BGRM, ACH_MEDU, ACH_SOKO, LL_ACHIEVE } from '../js/const.js';


// do.c:1908-1916: entering the Sokoban branch for the first time records
// ACH_SOKO, whose achieve_msg[] line is "entered Sokoban".
void test('arriving in the Sokoban branch chronicles the branch entry', async () => {
    await freshObjectRoom();
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
        { turn, text: 'entered Sokoban', flags: LL_ACHIEVE });
});

// do.c:1693-1700, 1915: the Bigroom achievement needs a newly made level
// (`new`), not just a branch change; a cached revisit records nothing.
void test('arriving on a new Bigroom level chronicles it, a revisit does not', async () => {
    await freshObjectRoom();
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
        { turn, text: 'entered the Bigroom', flags: LL_ACHIEVE });

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
    await freshObjectRoom();
    resetInputState();
    const medusa = await createMonsterAt('Medusa', 11, 10);
    const turn = game.moves;

    await finishHeroMonsterKill(medusa, 11, 10);

    assert.ok(achievementEntries(game).includes(ACH_MEDU));
    assert.ok(gameLogEvents().some(entry => entry.turn === turn
        && entry.text === 'killed Medusa'),
        `chronicle must hold the Medusa kill: ${JSON.stringify(gameLogEvents())}`);
});

