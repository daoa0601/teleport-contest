import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
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
//# sourceMappingURL=wizard_migration.test.js.map