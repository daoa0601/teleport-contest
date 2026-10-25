import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { HOLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { WAN_DIGGING } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

// C dig.c digactualhole(): the Castle's holes deliver their victims to the
// Valley of Gehennom rather than the nominal next level.
void test('a hole in the Castle drops its victim into the Valley', async () => {
    const level = freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    game.dungeons = [
        createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 }),
        createDungeon({ dname: 'Gehennom', num_dunlevs: 25 }),
    ];
    game.stronghold_level = createSpecialLevel({ dnum: 0, dlevel: 8 });
    game.valley_level = createSpecialLevel({ dnum: 1, dlevel: 1 });
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 500;
    grantIntrinsicProperty('levitation', 'outside');
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 10 });
    const input = resetInputState();
    installPagerInput(input, { expected: /wand|pit|hole|goblin/i, limit: 30 });
    input.feed(`${wand.invlet}y`);
    initRng(19n);

    await rhack('a'.charCodeAt(0));

    assert.equal(level.traps.find(trap => trap.tx === 11 && trap.ty === 10)?.ttyp, HOLE);
    assert.equal(level.monsters.includes(goblin), false);
    assert.equal(goblin.migrationDestination?.dnum, 1);
    assert.equal(goblin.migrationDestination?.dlevel, 1);
});

// C dig.c digactualhole(): a shopkeeper taking the fall turns angry even
// though the hole was not aimed at her.
void test('a shopkeeper falling through a dug hole turns angry', async () => {
    const level = freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    const keeper = await createMonsterAt('shopkeeper', 11, 10);
    keeper.mpeaceful = 1;
    keeper.mhp = keeper.mhpmax = 500;
    grantIntrinsicProperty('levitation', 'outside');
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 10 });
    const input = resetInputState();
    installPagerInput(input, { expected: /wand|pit|hole|shopkeeper|angry/i, limit: 30 });
    input.feed(`${wand.invlet}y`);
    initRng(19n);

    await rhack('a'.charCodeAt(0));

    assert.equal(level.traps.find(trap => trap.tx === 11 && trap.ty === 10)?.ttyp, HOLE);
    assert.equal(level.monsters.includes(keeper), false);
    assert.equal(keeper.mpeaceful, 0);
});
