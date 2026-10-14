import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinetown } from '../js/mklev.js';
import { MONSTER_FLAGS2, MONSTER_NAME } from '../js/monster_data.js';
import { MM_NOGRP, NON_PM } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshSpecialLevel } from './support/special-level.js';
void test('ransacked Minetown sends its raiders and named stolen goods into the lower Mines', async () => {
    const active = freshSpecialLevel({ prototype: 'minetn', variant: 1, seed: 131, depth: 3 });
    requirePlayingGame(game);
    const mines = game.dungeons[0];
    assert.ok(mines);
    mines.dname = 'The Gnomish Mines';
    mines.num_dunlevs = 8;
    game.mines_dnum = 0;
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
    const stolen = loot[0];
    assert.ok(stolen);
    const remaining = loot.length;
    const buyer = await createMonsterAt('hill orc', 1, 1, MM_NOGRP);
    assert.equal(loot.length, remaining - 1, 'each new orc receives one stolen item');
    assert.equal(buyer.inventory.includes(stolen), true);
    assert.match(buyer.name ?? '', / of /);
    assert.equal(stolen.oextra?.oname, undefined);
    assert.equal(stolen.migration, undefined);
    assert.equal(stolen.corpsenm, NON_PM);
});
//# sourceMappingURL=orc_raid.test.js.map