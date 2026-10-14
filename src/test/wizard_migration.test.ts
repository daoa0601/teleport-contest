import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
import { AMULET_OF_YENDOR, DAGGER } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { knownObject } from './support/game-objects.js';

void test('#migratemons lets a monster carry protected objects to its destination', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 12 })];
    const monster = await createMonsterAt('lichen', 11, 10);
    const amulet = await knownObject(AMULET_OF_YENDOR, { initialize: false });
    const dagger = await knownObject(DAGGER, { initialize: false });
    await addObjectToMonsterInventory(monster, amulet);
    await addObjectToMonsterInventory(monster, dagger);
    installPagerInput(resetInputState(), { expected: /migrating/, limit: 4 });

    await runExtendedCommand('migratemons', ' -1\n');

    assert.ok(monster.minvent?.includes(amulet), 'The migrating monster must retain the Amulet');
    assert.ok(monster.minvent?.includes(dagger), 'The migrating monster must retain ordinary inventory');
    assert.equal(amulet.ocarry, monster);
    assert.equal(level.objects[11]?.[10]?.includes(amulet) ?? false, false);
    assert.deepEqual(monster.migrationDestination, { dnum: 0, dlevel: 9 });
    assert.equal(game.context.move, 0);
});

void test('a negative #migratemons count sends existing monsters to the next level', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 12 })];
    const first = await createMonsterAt('lichen', 11, 10);
    const second = await createMonsterAt('lichen', 12, 10);
    const input = resetInputState();
    installPagerInput(input, { expected: /migrating/, limit: 4 });

    await runExtendedCommand('migratemons', ' -2\n');

    assert.equal(level.monsters.length, 0);
    for (const monster of [first, second]) {
        assert.ok(game._migratingMonsters?.includes(monster));
        assert.deepEqual(monster.migrationDestination, { dnum: 0, dlevel: 9 });
    }
    assert.equal(game.context.move, 0);
});

void test('a negative #migratemons count starts with the most recently created monster', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 12 })];
    const oldest = await createMonsterAt('lichen', 11, 10);
    const newest = await createMonsterAt('lichen', 12, 10);
    installPagerInput(resetInputState(), { expected: /migrating/, limit: 4 });

    await runExtendedCommand('migratemons', ' -1\n');

    assert.ok(level.monsters.includes(oldest), 'The older monster must stay on the current level');
    assert.ok(game._migratingMonsters?.includes(newest), 'The newest monster must migrate first');
    assert.equal(game.context.move, 0);
});
