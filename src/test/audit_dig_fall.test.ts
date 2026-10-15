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
import { createDungeon } from './support/topology.js';

void test('a visible ceiling-clinger stays above a hole made by a broken digging wand', async () => {
    const level = freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    const wumpus = await createMonsterAt('wumpus', 11, 10);
    wumpus.mhp = wumpus.mhpmax = 500;
    wumpus.mundetected = 0;
    wumpus.msleeping = 0;
    grantIntrinsicProperty('levitation', 'outside');
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 10 });
    const input = resetInputState();
    installPagerInput(input, { expected: /wand|pit|hole|Boom|blast|caught|wumpus/i, limit: 30 });
    input.feed(`${wand.invlet}y`);
    initRng(19n);

    await rhack('a'.charCodeAt(0));

    assert.equal(level.traps.find(trap => trap.tx === 11 && trap.ty === 10)?.ttyp, HOLE);
    assert.ok(level.monsters.includes(wumpus), 'A clinger with a ceiling cannot fall through the new hole.');
    assert.equal(wumpus.mx, 11);
    assert.equal(wumpus.my, 10);
    assert.equal(wand.where, 'gone');
});
