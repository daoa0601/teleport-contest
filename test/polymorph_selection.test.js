import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { G_GENOD } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { nameToMonster } from '../js/mondata.js';
import {
    RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, WAN_POLYMORPH,
} from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject } from './support/game-objects.js';
import { wearPolymorphControlRing } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

test('wizard polymorph rejects a forbidden form and accepts the next choice', async () => {
    freshObjectRoom({ flags: { debug: true } });
    pushKeys('polyself\nMedusa\nnewt\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, nameToMonster('newt'));
    assert.equal(game.u.uconduct.polyselfs, 1);
    assert.equal(game.context.move, 0);
});

test('cancelling wizard polymorph leaves the current body alone', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const health = game.u.uhp;
    pushKeys('polyself\n\x1b');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.uhp, health);
    assert.equal(game.u.uconduct.polyselfs ?? 0, 0);
});

test('a selected monster class excludes its genocided members', async () => {
    freshObjectRoom({ flags: { debug: true } });
    for (const name of ['water nymph', 'mountain nymph'])
        game.mvitals[nameToMonster(name)] = { mvflags: G_GENOD };
    pushKeys('polyself\nn\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, nameToMonster('wood nymph'));
});

test('a controlled polymorph wand lets a lycanthrope request its wolf form', async () => {
    freshObjectRoom();
    const wand = addInventoryObject(WAN_POLYMORPH, {
        spe: 3,
    });
    wearPolymorphControlRing();
    game.u.ulycn = nameToMonster('werewolf');
    pushKeys(`${wand.invlet}.wolf\n                `);

    await rhack('z'.charCodeAt(0));

    assert.equal(game.u.umonnum, game.u.ulycn);
    assert.equal(wand.spe, 2);
    assert.equal(game.context.move, 1);
});

test('dragon mail becomes skin and returns as scales after saving', async () => {
    freshObjectRoom({ flags: { debug: true } });
    game.plname = 'Dragon';
    const armor = addInventoryObject(RED_DRAGON_SCALE_MAIL, {
        spe: 3, blessed: true,
    });
    wearHeroArmor(armor);
    pushKeys('polyself\nred dragon\n                ');
    await rhack('#'.charCodeAt(0));

    assert.equal(game.uskin, armor);
    assert.equal(game.uarm, null);
    assert.equal(armor.otyp, RED_DRAGON_SCALES);
    assert.equal(game.u.umonnum, nameToMonster('red dragon'));
    const storage = memoryStorage();
    assert.equal(saveGame(storage), true);
    assert.equal(restoreGame('Dragon', storage), true);
    const restoredArmor = game.inventory.find(
        object => object.otyp === RED_DRAGON_SCALES,
    );
    assert.equal(game.uskin, restoredArmor);
    resetInputState();
    pushKeys('polyself\ncaveman\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.uskin, null);
    assert.equal(game.uarm, restoredArmor);
    assert.equal(restoredArmor.spe, 3);
    assert.equal(restoredArmor.blessed, true);
});

test('genocide prevents dragon armor from merging into the hero', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const dragon = nameToMonster('red dragon');
    game.mvitals[dragon] = { mvflags: G_GENOD };
    const armor = addInventoryObject(RED_DRAGON_SCALE_MAIL);
    wearHeroArmor(armor);
    pushKeys('polyself\nred dragon\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.uarm, armor);
    assert.equal(armor.otyp, RED_DRAGON_SCALE_MAIL);
    assert.ok(!game.uskin);
});
