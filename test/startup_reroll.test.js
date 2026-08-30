import test from 'node:test';
import assert from 'node:assert/strict';

import { decodeScreen } from '../frozen/screen-decode.mjs';
import { game, resetGame } from '../js/gstate.js';
import { currentConductLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { aligns, races, roles } from '../js/roles.js';
import {
    finishStartingDiscoveries, uInitInventoryAttrs, uInitMisc,
} from '../js/u_init.js';


function screenText(encoded) {
    return decodeScreen(encoded).map(row =>
        row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

function wizardCandidate(seed = 8271n) {
    resetGame();
    initRng(seed);
    game.urole = roles.find(role => role.key === 'wizard');
    game.urace = races.find(race => race.name === 'human');
    game.initAlignment = aligns.find(alignment => alignment.name === 'neutral');
    game.flags = { reroll: true };
    init_objects();
    uInitMisc(1);
    assert.equal(uInitInventoryAttrs(), true);
    return game;
}

test('disposable candidates defer equipment, spells, discoveries, and skills', () => {
    const state = wizardCandidate();
    const firstIds = new Set(state.inventory.map(item => item.o_id));

    assert.equal(state.uwep, null);
    assert.equal(state.uarmc, null);
    assert.deepEqual(state.spells, []);
    assert.equal(state.u.weaponSkills, null);
    assert.equal(state._encounteredObjectTypes?.size || 0, 0);

    assert.equal(uInitInventoryAttrs(), true);
    assert.equal(
        state.inventory.some(item => firstIds.has(item.o_id)),
        false,
    );
    assert.equal(state.uwep, null);
    assert.deepEqual(state.spells, []);
    assert.equal(state.u.weaponSkills, null);
    assert.equal(state._encounteredObjectTypes?.size || 0, 0);

    const initialPower = state.u.uenmax;
    assert.equal(finishStartingDiscoveries(), true);
    assert.ok(state.uwep);
    assert.ok(state.spells.length > 0);
    assert.ok(state.u.weaponSkills);
    if (initialPower < 5) assert.equal(state.u.ueninc[1], 5);
    assert.ok(state._encounteredObjectTypes.size > 0);
    assert.equal(finishStartingDiscoveries(), false);
});

test('fresh startup rerolls once and accepts the final candidate', async () => {
    const result = await runSegment({
        seed: 8272,
        datetime: '20260829162500',
        nethackrc: [
            'OPTIONS=name:Reroller,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=reroll,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: 'rp.',
        storage: new Map(),
    });
    const screens = result.getScreens().map(screenText);

    assert.match(screens[0], /Reroll this character\?/);
    assert.match(screens[0], /p - start the game with this character/);
    assert.match(screens[0], /r - reroll another character/);
    assert.match(screens[0], /St:\S+ Dx:\d+ Co:\d+ In:\d+ Wi:\d+ Ch:\d+/);
    assert.doesNotMatch(screens[0], /weapon in hands|being worn/);
    assert.match(screens[1], /Reroll this character\?/);
    assert.notEqual(screens[0], screens[1]);

    assert.equal(game.u.uroleplay.reroll, true);
    assert.equal(game.u.uroleplay.numrerolls, 1);
    assert.ok(game.uwep);
    assert.ok(game.spells.length > 0);
    assert.ok(game.u.weaponSkills);
    assert.ok(currentConductLines().includes(
        ' Your character was rerolled once.',
    ));
});

test('closing the menu uses the source yes-no fallback without spending a turn', async () => {
    const result = await runSegment({
        seed: 8274,
        datetime: '20260829162700',
        nethackrc: [
            'OPTIONS=name:Cancel,role:Wizard,race:human,gender:male,align:neutral',
            'OPTIONS=reroll,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: '\x1b\x1b.',
        storage: new Map(),
    });
    const screens = result.getScreens().map(screenText);

    assert.match(screens[0], /Reroll this character\?/);
    assert.match(screens[1], /Reroll this character\? \[yn\] \(n\)/);
    assert.equal(game.u.uroleplay.numrerolls, 0);
    assert.ok(currentConductLines().includes(
        ' Your character was not rerolled.',
    ));
});

test('lootabc assigns automatic menu letters without changing reroll state', async () => {
    const result = await runSegment({
        seed: 8273,
        datetime: '20260829162600',
        nethackrc: [
            'OPTIONS=name:Alphabet,role:Ranger,race:gnome,gender:female,align:neutral',
            'OPTIONS=reroll,lootabc,!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: 'ba.',
        storage: new Map(),
    });
    const screens = result.getScreens().map(screenText);

    assert.match(screens[0], /a - start the game with this character/);
    assert.match(screens[0], /b - reroll another character/);
    assert.match(screens[1], /a - start the game with this character/);
    assert.equal(game.u.uroleplay.numrerolls, 1);
});
