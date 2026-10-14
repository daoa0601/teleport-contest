import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinetown } from '../js/mklev.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from '../js/monster_data.js';
import { freshSpecialLevel } from './support/special-level.js';

void test('ransacked Minetown sends its raiders and named stolen goods into the lower Mines', async () => {
    const active = freshSpecialLevel({ prototype: 'minetn', variant: 1, seed: 131, depth: 3 });
    requirePlayingGame(game);
    const mines = game.dungeons[0];
    assert.ok(mines);
    mines.dname = 'The Gnomish Mines';
    mines.num_dunlevs = 8;

    await generateMinetown(active);

    const raiders = game._migratingMonsters ?? [];
    const captain = raiders.find(monster => monster.mnum === MONSTER_NAME.indexOf('orc-captain'));
    assert.ok(captain, 'the raiding gang must have a migrating captain');
    assert.ok(captain.name, 'the captain carries the gang name');
    assert.ok(raiders.length >= 6 && raiders.length <= 15);
    for (const raider of raiders) {
        assert.ok((MONSTER_FLAGS2[raider.mnum] ?? 0) & 0x80);
        assert.equal(raider.migrationDestination?.dnum, 0);
        assert.ok((raider.migrationDestination?.dlevel ?? 0) > 3);
        assert.equal(game.level.monsters.includes(raider), false);
    }
    const loot = game.migratingObjects ?? [];
    assert.ok(loot.length > 0, 'unclaimed stolen goods must remain available for later orcs');
    assert.ok(loot.every(object => object.where === 'migrating' && !!object.oextra?.oname));
});
