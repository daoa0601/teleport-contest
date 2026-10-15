import assert from 'node:assert/strict';
import test from 'node:test';
import { LADDER, MIGR_SSTAIRS, MM_ANGRY, NO_MINVENT, STAIRS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from '../js/monster_defensive_item.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
for (const carriesAmulet of [false, true]) {
    void test(`a branch stair at the dungeon entrance ${carriesAmulet ? 'keeps an Amulet carrier in the dungeon' : 'lets a monster escape the dungeon'}`, async () => {
        const level = freshObjectRoom({ heroX: 14, heroY: 10, hero: { uz: { dnum: 0, dlevel: 1 } } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' }), createDungeon({ dname: 'The Gnomish Mines' })];
        const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
        monster.mhp = 1;
        monster.mhpmax = 100;
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        if (carriesAmulet)
            await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR), game);
        level.requireAt(10, 10).typ = STAIRS;
        game.stairs = { sx: 10, sy: 10, up: false, isladder: false,
            tolev: { dnum: 1, dlevel: 1 }, next: null, u_traversed: false };
        const choice = findMonsterDefensiveItem(monster, game);
        assert.ok(choice?.kind === 'stairs');
        const messages = [];
        const result = await useMonsterDefensiveItem(monster, choice, {
            state: game, publish: message => { messages.push(message); },
        });
        assert.equal(result.nativeResult, carriesAmulet ? 0 : 2);
        assert.equal(level.monsters.includes(monster), carriesAmulet);
        assert.equal(monster.migrationDestination, undefined);
        assert.equal(messages.includes('The orc escapes the dungeon!'), !carriesAmulet);
    });
}
void test('a ladder across a dungeon branch uses the special-stair escape and arrival', async () => {
    const level = freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom' }), createDungeon({ dname: 'The Gnomish Mines' })];
    const monster = await createMonsterAt('orc', 10, 10, MM_ANGRY | NO_MINVENT);
    monster.mhp = 1;
    monster.mhpmax = 100;
    monster.mux = game.u.ux;
    monster.muy = game.u.uy;
    level.requireAt(10, 10).typ = LADDER;
    game.stairs = { sx: 10, sy: 10, up: true, isladder: true,
        tolev: { dnum: 1, dlevel: 1 }, next: null, u_traversed: false };
    const choice = findMonsterDefensiveItem(monster, game);
    assert.ok(choice?.kind === 'stairs');
    const messages = [];
    await useMonsterDefensiveItem(monster, choice, { state: game, publish: message => { messages.push(message); } });
    assert.equal(messages[0], 'The orc escapes upstairs!');
    assert.equal(monster.migrationMode, MIGR_SSTAIRS);
    assert.deepEqual(monster.migrationDestination, { dnum: 1, dlevel: 1 });
});
//# sourceMappingURL=monster_muse_stairs.test.js.map