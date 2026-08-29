import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { game, resetGame } from '../js/gstate.js';
import { currentConductLines, finalConductLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import {
    FLINT, FOOD_RATION, POT_WATER, SACK, SPE_FORCE_BOLT, SPE_HEALING,
    SPE_PROTECTION, TOUCHSTONE, WAN_WISHING,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { parseNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';
import { aligns, races, roles } from '../js/roles.js';
import { makedog, uInitInventoryAttrs, uInitMisc } from '../js/u_init.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function start(roleKey, raceName = 'human', flags = { pauper: true }) {
    resetGame();
    initRng(123n);
    game.urole = roles.find(role => role.key === roleKey);
    game.urace = races.find(race => race.name === raceName);
    game.initAlignment = aligns.find(alignment => alignment.name === 'chaotic');
    game.flags = { ...flags };
    init_objects();
    uInitMisc(1);
    assert.equal(uInitInventoryAttrs(), true);
    return game;
}

test('pauper implies nudist at its option position and allows later override', () => {
    assert.deepEqual(
        parseNethackrc('OPTIONS=pauper,!nudist').flags,
        { pauper: true, nudist: false },
    );
    assert.deepEqual(
        parseNethackrc('OPTIONS=!nudist,pauper').flags,
        { nudist: true, pauper: true },
    );
});

test('every pauper role starts empty, untrained, and selectively preknown', () => {
    const expectedKnowledge = new Map([
        ['archeologist', [TOUCHSTONE]],
        ['barbarian', []],
        ['caveman', [FLINT]],
        ['healer', [SPE_HEALING]],
        ['knight', [SPE_PROTECTION]],
        ['monk', [SPE_PROTECTION]],
        ['priest', [POT_WATER, SPE_PROTECTION]],
        ['ranger', []],
        ['rogue', [SACK]],
        ['samurai', [FOOD_RATION]],
        ['tourist', [SACK]],
        ['valkyrie', []],
        ['wizard', [SPE_FORCE_BOLT]],
    ]);

    for (const role of roles) {
        const state = start(role.key, 'human', {
            pauper: true, nudist: true, explore: true,
        });
        assert.deepEqual(state.inventory, [], role.key);
        assert.deepEqual(state.spells, [], role.key);
        assert.equal(state._goldCount, 0, role.key);
        assert.equal(state._initialGoldCount, 0, role.key);
        assert.equal(state.u.weapon_slots, 2, role.key);
        assert.equal(
            state.u.weaponSkills.some(skill => skill.skill > 1),
            false,
            role.key,
        );
        assert.deepEqual(
            [...state._knownObjectTypes],
            expectedKnowledge.get(role.key),
            role.key,
        );
        assert.deepEqual(state.discoveries, [], role.key);
        assert.equal(
            state.inventory.some(object => object.otyp === WAN_WISHING),
            false,
            role.key,
        );
    }
});

test('pauper suppresses race inventory and knowledge but retains override', () => {
    const elfWizard = start('wizard', 'elf', { pauper: true });
    assert.deepEqual([...elfWizard._knownObjectTypes], [SPE_FORCE_BOLT]);
    assert.deepEqual(elfWizard.inventory, []);

    const orcRanger = start('ranger', 'orc', { pauper: true });
    assert.deepEqual([...orcRanger._knownObjectTypes], []);
    assert.deepEqual(orcRanger.inventory, []);

    const priest = start('priest', 'human', { pauper: true });
    assert.deepEqual(
        [...priest._knownObjectTypes],
        [POT_WATER, SPE_PROTECTION],
    );
});

test('standalone nudist constructs no hero armor without becoming pauper', () => {
    const state = start('knight', 'human', {
        pauper: false, nudist: true,
    });

    assert.ok(state.inventory.length > 0);
    assert.equal(state.inventory.some(object => object.oclass === 3), false);
    assert.ok(state.inventory.some(object => object.oclass === 2));
    assert.ok(state.inventory.some(object => object.oclass === 7));
    assert.ok(state.u.weaponSkills.some(skill => skill.skill > 1));
    assert.equal(state.u.weapon_slots, undefined);
});

function startingPony(pauper) {
    resetGame();
    initRng(456n);
    game.urole = roles.find(role => role.key === 'knight');
    game.urace = races.find(race => race.name === 'human');
    game.initAlignment = aligns.find(alignment => alignment.name === 'lawful');
    game.flags = { pauper };
    init_objects();
    uInitMisc(1);
    game.u.ux = 40;
    game.u.uy = 10;
    game.level = {
        at: () => ({ typ: ROOM }), objects: [], monsters: [], flags: {},
    };
    return makedog();
}

test('pauper Knight keeps the pony but suppresses its starting saddle', () => {
    const pauperPony = startingPony(true);
    assert.ok(pauperPony);
    assert.equal(pauperPony.saddled, undefined);
    assert.equal(pauperPony.saddle, undefined);

    const ordinaryPony = startingPony(false);
    assert.equal(ordinaryPony.saddled, true);
    assert.ok(ordinaryPony.saddle);
});

test('conduct disclosure projects pauper and implied nudist state', () => {
    const state = start('wizard');
    state.u.uconduct = {};
    assert.ok(currentConductLines().includes(' You are without possessions.'));
    assert.ok(currentConductLines().includes(' You have been faithfully nudist.'));
    assert.ok(finalConductLines().includes(' You started out without possessions.'));
    assert.ok(finalConductLines().includes(' You were faithfully nudist.'));
});

test('fresh bridge-free pauper startup uses the untrained legacy page', async () => {
    const result = await runSegment({
        seed: 123,
        datetime: '20260829134500',
        nethackrc: 'OPTIONS=name:Pauper,role:Wizard,race:human,'
            + 'gender:male,align:neutral,pauper,legacy,!tutorial,pettype:none',
        moves: ' ',
        storage: new Map(),
    });
    const screen = decodeScreen(result.getScreens()[0])
        .map(row => row.map(cell => cell.ch).join('')).join('\n');

    assert.match(screen, /You, an untrained Evoker, have been unable/);
    assert.match(screen, /prepare to be the instrument of Thoth/);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual([...game._knownObjectTypes], [SPE_FORCE_BOLT]);
    assert.equal(game.u.weapon_slots, 2);
    assert.deepEqual(result.getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
});
