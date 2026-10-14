import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, NO_MINVENT, STONE } from '../js/const.js';
import { vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { initializePet } from '../js/dog.js';
void test('a zero banishment roll sends the demon to the preceding dungeon bottom', async () => {
    const level = freshObjectRoom({ role: 'priest', hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    game.valley_level = createSpecialLevel({ dnum: 2, dlevel: 1 });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
        createDungeon({ dname: 'The Gnomish Mines', num_dunlevs: 7 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 1, flags: { hellish: true } }),
    ];
    const sword = await artifactObject('Demonbane', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [sword];
    const demon = await createMonsterAt('horned devil', 11, 10, MM_ANGRY | MM_NOGRP | MM_NOMSG | NO_MINVENT);
    await invokeInventoryObject(sword, ' '.repeat(20));
    assert.equal(level.monsters.includes(demon), false);
    assert.deepEqual(demon.migrationDestination, { dnum: 1, dlevel: 7 });
    assert.equal(game.context.move, 1);
});
void test('Demonbane banishes visible demons and imps, leaving other creatures and hidden demons here', async () => {
    const level = freshObjectRoom({ role: 'priest', hero: { ualign: { type: 1, record: 10 } } });
    requirePlayingGame(game);
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 20, flags: { hellish: true } }),
    ];
    const sword = await artifactObject('Demonbane', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [sword];
    const flags = MM_ANGRY | MM_NOGRP | MM_NOMSG | NO_MINVENT;
    const demon = await createMonsterAt('horned devil', 11, 10, flags);
    demon.minvis = 1;
    initializePet(demon);
    const imp = await createMonsterAt('imp', 11, 11, flags);
    const gnome = await createMonsterAt('gnome', 11, 12, flags);
    const hidden = await createMonsterAt('horned devil', 14, 10, flags);
    for (let y = 6; y <= 14; y++) {
        level.requireAt(13, y).typ = STONE;
        vision_note_blocker_change(13, y);
    }
    vision_recalc(0);
    await invokeInventoryObject(sword, ' '.repeat(20));
    for (const banished of [demon, imp]) {
        assert.equal(level.monsters.includes(banished), false);
        assert.equal(banished.migrationDestination?.dnum, 1);
        assert.equal(banished.mtame, 0);
        assert.equal(Boolean(banished.pet), false);
        assert.equal(banished.mpeaceful, 0);
        assert.equal(banished.msleeping, 0);
    }
    assert.equal(level.monsters.includes(gnome), true);
    assert.equal(level.monsters.includes(hidden), true);
    assert.match(game._pending_message, /The demons disappear in a cloud of brimstone!/);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=artifact_invoke_banish.test.js.map