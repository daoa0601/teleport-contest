import assert from 'node:assert/strict';
import test from 'node:test';

import { adjustHeroAlignment } from '../js/alignment.js';
import { MAGIC_PORTAL, NO_MINVENT, WATER } from '../js/const.js';
import { monsterExperience } from '../js/exper.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { rollMonsterPoolReaction } from '../js/mon.js';
import { attackMonsterWithMonster, monsterDistressEvents, takeMonsterTurn } from '../js/monmove.js';
import { monsterHasLineOfSightToHero } from '../js/monster_perception.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { restoreGame, saveGame } from '../js/save.js';
import { monsterFliesOrFloats } from '../js/terrain_properties.js';
import { teleportMonsterThroughPortal } from '../js/teleport.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('erinyes begin seeing an invisible hero above five alignment abuse', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('invisible', 'outside');
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    adjustHeroAlignment(-5);
    assert.equal(monsterHasLineOfSightToHero(erinys), false);

    adjustHeroAlignment(-1);

    assert.equal(monsterHasLineOfSightToHero(erinys), true);
});

void test('erinyes survive underwater above ten alignment abuse', async () => {
    const level = freshObjectRoom();
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    level.requireAt(12, 10).typ = WATER;
    adjustHeroAlignment(-10);
    assert.equal(rollMonsterPoolReaction(erinys).kind, 'drown');

    adjustHeroAlignment(-1);

    assert.equal(rollMonsterPoolReaction(erinys).kind, 'safe');
});

void test('erinyes gain flight above fifteen abuse and a new game clears the upgrade', async () => {
    freshObjectRoom();
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    adjustHeroAlignment(-15);
    assert.equal(monsterFliesOrFloats(erinys), false);
    adjustHeroAlignment(-1);
    assert.equal(monsterFliesOrFloats(erinys), true);
    adjustHeroAlignment(10);
    assert.equal(monsterFliesOrFloats(erinys), true, 'improving alignment does not undo accumulated abuse');

    freshObjectRoom();
    const newErinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);

    assert.equal(monsterFliesOrFloats(newErinys), false);
});

for (const [abuse, expectedDamage] of [[20, 8], [21, 12], [35, 12], [36, 24]] satisfies [number, number][]) {
    void test(`an erinys at ${abuse} alignment abuse deals ${expectedDamage} unarmed weapon damage`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
        const golem = await createMonsterAt('iron golem', 13, 10, NO_MINVENT);
        erinys.m_lev = 30;
        golem.mhp = golem.mhpmax = 200;
        adjustHeroAlignment(-abuse);
        installPagerInput(resetInputState(), { expected: /erinys|golem/, limit: 8 });

        await attackMonsterWithMonster(erinys, golem, {
            state: game, random: limit => limit - 1, rollOne: () => 1,
            rollDice: (count, sides) => count * sides,
        });

        assert.equal(golem.mhp, 200 - expectedDamage, 'the poison-resistant defender takes the weapon dice from each hit');
    });
}

void test('erinyes regenerate each turn above twenty-five alignment abuse', async () => {
    freshObjectRoom({ moves: 1 });
    requirePlayingGame(game);
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    erinys.mhp = 10;
    erinys.mhpmax = 20;
    adjustHeroAlignment(-25);
    for await (const event of monsterDistressEvents([erinys], game)) void event;
    assert.equal(erinys.mhp, 10);

    adjustHeroAlignment(-1);
    for await (const event of monsterDistressEvents([erinys], game)) void event;

    assert.equal(erinys.mhp, 11);
});

for (const abuse of [30, 31]) {
    void test(`a portal leaves an erinys ${abuse > 30 ? 'oriented' : 'confused'} at ${abuse} alignment abuse`, async () => {
        const { source } = freshConnectedLevels();
        requirePlayingGame(game);
        const erinys = await createMonsterAt('erinys', 11, 10, NO_MINVENT);
        const trap = addTrap(source, MAGIC_PORTAL, 11, 10, { dst: { dnum: 0, dlevel: 2 } });
        adjustHeroAlignment(-abuse);

        await teleportMonsterThroughPortal(erinys, trap, { publish: async () => {} });

        assert.deepEqual(erinys.migrationDestination, { dnum: 0, dlevel: 2 });
        assert.equal(!!erinys.mconf, abuse <= 30);
    });
}

for (const abuse of [40, 41]) {
    void test(`a fleeing erinys ${abuse > 40 ? 'can' : 'cannot'} teleport at ${abuse} alignment abuse`, async () => {
        freshObjectRoom({ right: 22 });
        requirePlayingGame(game);
        const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
        erinys.mflee = 1;
        erinys.msleeping = 0;
        adjustHeroAlignment(-abuse);

        await takeMonsterTurn(erinys, game,
            limit => limit === 40 ? 0 : limit === 21 ? 10 : limit - 1,
            undefined, limit => limit === 79 ? 20 : 1);

        if (abuse > 40) assert.equal(erinys.mx, 20, 'crossing the room in one move requires teleportation');
        else assert.ok(Math.abs(erinys.mx - 12) <= 1, 'ordinary movement stays within one square');
    });
}

void test('the extra erinys spell attack increases kill experience above fifty alignment abuse', async () => {
    freshObjectRoom();
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    erinys.m_lev = 10;
    adjustHeroAlignment(-50);
    const before = monsterExperience(erinys);

    adjustHeroAlignment(-1);

    assert.equal(monsterExperience(erinys) - before, 20, 'the spell adds ten experience plus the monster level');
});

void test('restoring a game rebuilds erinys flight from saved alignment abuse', async () => {
    freshObjectRoom();
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    const species = erinys.mnum;
    const storage = memoryStorage();
    game.plname = 'Furies';
    adjustHeroAlignment(-16);
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    assert.equal(monsterFliesOrFloats({ mnum: species }), false);

    assert.equal(restoreGame('Furies', storage), true);

    assert.equal(monsterFliesOrFloats({ mnum: species }), true);
});

void test('restoring a game without alignment abuse clears later erinys upgrades', async () => {
    freshObjectRoom();
    const erinys = await createMonsterAt('erinys', 12, 10, NO_MINVENT);
    const species = erinys.mnum;
    const storage = memoryStorage();
    game.plname = 'Furies';
    assert.equal(await saveGame(storage), true);
    adjustHeroAlignment(-16);
    assert.equal(monsterFliesOrFloats(erinys), true);

    assert.equal(restoreGame('Furies', storage), true);

    assert.equal(monsterFliesOrFloats({ mnum: species }), false);
});

