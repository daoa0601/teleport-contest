import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { HOLE, PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maketrap } from '../js/mklev.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
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

void test('a monster drops only one level when a digging wand opens a hole beneath it', async () => {
    const level = freshObjectRoom({ hero: { uhp: 500, uhpmax: 500 } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mhp = goblin.mhpmax = 500;
    grantIntrinsicProperty('levitation', 'outside');
    const wand = await addInventoryObject(WAN_DIGGING, { spe: 10 });
    const input = resetInputState();
    installPagerInput(input, { expected: /wand|pit|hole|Boom|blast|caught|goblin/i, limit: 30 });
    input.feed(`${wand.invlet}y`);
    initRng(19n);

    await rhack('a'.charCodeAt(0));

    assert.equal(level.traps.find(trap => trap.tx === 11 && trap.ty === 10)?.ttyp, HOLE);
    assert.equal(level.monsters.includes(goblin), false);
    assert.deepEqual(goblin.migrationDestination, { dnum: 0, dlevel: 9 });
});

for (const name of [null, 'Pip']) {
    void test(`${name ? 'a named' : 'an unnamed'} monster takes its fall damage when a digging zap opens a pit beneath it`, async () => {
        freshObjectRoom();
        await maketrap(10, 10, PIT);
        game.u.utrap = 5;
        game.u.utraptype = TT_PIT;
        const goblin = await createMonsterAt('goblin', 11, 10);
        goblin.mhp = goblin.mhpmax = 40;
        if (name) setMonsterGivenName(goblin, name);
        const wand = await addInventoryObject(WAN_DIGGING, { spe: 2 });
        const input = resetInputState();
        installPagerInput(input, { expected: /dig|pit|goblin/i, limit: 10 });
        input.feed(`${wand.invlet}l`);

        await rhack('z'.charCodeAt(0));

        assert.equal(goblin.mtrapped, 1);
        assert.ok(goblin.mhp >= 34 && goblin.mhp < 40, 'Falling into an ordinary pit deals 1-6 damage.');
        assert.match(game._pending_message, name
            ? /(?:^|  )Pip falls into your pit!$/
            : /(?:^|  )The goblin falls into your pit!$/);
    });
}
