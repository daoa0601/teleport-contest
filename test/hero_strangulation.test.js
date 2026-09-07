import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { _statusLine2 } from '../js/display.js';
import { game } from '../js/gstate.js';
import { loseHeroHp } from '../js/hero_damage.js';
import {
    advanceHeroStrangulation, heroIsStrangled,
} from '../js/hero_strangulation.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { AMULET_OF_STRANGULATION, LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

test('putting on the amulet starts strangulation and taking it off stops it', async () => {
    freshObjectRoom();
    const amulet = addInventoryObject(AMULET_OF_STRANGULATION);
    pushKeys(`${amulet.invlet}        `);

    await rhack('P'.charCodeAt(0));

    assert.equal(game.u.strangledTurns, 6);
    assert.ok(game._knownObjectTypes.has(AMULET_OF_STRANGULATION));
    assert.match(_statusLine2(), /Strngl/);
    resetInputState();
    pushKeys('        ');
    await rhack('R'.charCodeAt(0));
    assert.equal(heroIsStrangled(), false);
    assert.ok(game.inventory.includes(amulet));
    assert.doesNotMatch(_statusLine2(), /Strngl/);
});

test('an immune body stops strangulation until the human body returns', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const amulet = addInventoryObject(AMULET_OF_STRANGULATION);
    wearHeroAccessory(amulet, 'uamul');
    pushKeys('polyself\nstone golem\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(heroIsStrangled(), false);
    assert.equal(game.uamul, amulet);
    resetInputState();
    pushKeys('                ');
    await loseHeroHp(game.u.mh, 'injury');
    assert.equal(game.u.umonnum, game.u.umonster);
    assert.equal(game.u.strangledTurns, 6);
});

test('R removes the only accessory even when armor is also worn', async () => {
    freshObjectRoom();
    const armor = addInventoryObject(LEATHER_ARMOR);
    wearHeroArmor(armor);
    const amulet = addInventoryObject(AMULET_OF_STRANGULATION);
    wearHeroAccessory(amulet, 'uamul');
    pushKeys('        ');

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uarm, armor);
    assert.ok(!game.uamul);
    assert.equal(heroIsStrangled(), false);
});

test('changing between vulnerable bodies restarts the countdown', async () => {
    freshObjectRoom({ flags: { debug: true } });
    wearHeroAccessory(addInventoryObject(AMULET_OF_STRANGULATION), 'uamul');
    await advanceHeroStrangulation();
    assert.equal(game.u.strangledTurns, 5);
    pushKeys('polyself\ngoblin\n                ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.strangledTurns, 6);
});

test('a headless cloud can wear the amulet without being strangled', () => {
    freshObjectRoom();
    installPolymorphedHero('fog cloud');

    wearHeroAccessory(addInventoryObject(AMULET_OF_STRANGULATION), 'uamul');

    assert.equal(heroIsStrangled(), false);
});

test('a vampire is strangled despite not needing to breathe', () => {
    freshObjectRoom();
    installPolymorphedHero('vampire');

    wearHeroAccessory(addInventoryObject(AMULET_OF_STRANGULATION), 'uamul');

    assert.equal(game.u.strangledTurns, 6);
});

test('declining death from strangulation consumes the amulet', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const amulet = addInventoryObject(AMULET_OF_STRANGULATION);
    wearHeroAccessory(amulet, 'uamul');
    pushKeys('                                ');
    for (let turn = 0; turn < 5; turn++)
        await advanceHeroStrangulation();
    assert.equal(game.u.strangledTurns, 1);
    resetInputState();
    pushKeys('  n        ');

    const result = await advanceHeroStrangulation();

    assert.equal(result.died, false);
    assert.ok(game.u.uhp > 0);
    assert.equal(game.inventory.includes(amulet), false);
    assert.ok(!game.uamul);
    assert.equal(heroIsStrangled(), false);
});

test('strangulation kills a monster form without returning the hero to human form', async () => {
    freshObjectRoom({ flags: { bones: false, disclose: '-i -a -v -g -c -o' } });
    installPolymorphedHero('vampire');
    const form = game.u.umonnum;
    wearHeroAccessory(addInventoryObject(AMULET_OF_STRANGULATION), 'uamul');
    pushKeys('                                ');
    for (let turn = 0; turn < 5; turn++)
        await advanceHeroStrangulation();
    resetInputState();
    pushKeys('                                ');

    const result = await advanceHeroStrangulation();

    assert.equal(result.died, true);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game._deathKiller, 'strangulation');
    assert.equal(game.u.umonnum, form);
});
