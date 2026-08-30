import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName } from '../js/artifacts.js';
import { _statusLine2 } from '../js/display.js';
import { game, resetGame } from '../js/gstate.js';
import { currentConductLines, finalConductLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import { init_objects } from '../js/o_init.js';
import { LENSES } from '../js/object_data.js';
import { parseNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';
import { aligns, races, roles } from '../js/roles.js';
import {
    blindnessBlocked, blindfolded, syncBlindness, syncDeafness,
} from '../js/senses.js';
import { uInitMisc } from '../js/u_init.js';
import { cansee, couldsee } from '../js/vision.js';


function initializeSenses(flags) {
    resetGame();
    initRng(9182n);
    game.urole = roles.find(role => role.key === 'wizard');
    game.urace = races.find(race => race.name === 'human');
    game.initAlignment = aligns.find(alignment => alignment.name === 'neutral');
    game.flags = { ...flags };
    init_objects();
    uInitMisc(1);
    game.u.uconduct = {};
    return game;
}

test('blind and deaf option aliases retain ordered negation', () => {
    assert.deepEqual(
        parseNethackrc('OPTIONS=permablind,permadeaf').flags,
        { blind: true, deaf: true },
    );
    assert.deepEqual(
        parseNethackrc(
            'OPTIONS=blind,!permablind,deaf,!permadeaf',
        ).flags,
        { blind: false, deaf: false },
    );
});

test('startup installs permanent sensory sources and conduct separately', () => {
    const state = initializeSenses({ blind: true, deaf: true });

    assert.equal(state.u.uroleplay.blind, true);
    assert.equal(state.u.uroleplay.deaf, true);
    assert.equal(state.u.permaBlind, true);
    assert.equal(state.u.blindTurns, 0);
    assert.equal(state.u.deafTurns, 0);
    assert.equal(state.blind, true);
    assert.equal(state.u.blind, true);
    assert.equal(state.deaf, true);
    assert.equal(state.u.deaf, true);
    assert.match(_statusLine2(), / Blind Deaf$/);
    assert.ok(currentConductLines().includes(
        ' You have been blind from birth.',
    ));
    assert.ok(currentConductLines().includes(
        ' You have been deaf from birth.',
    ));
    assert.ok(finalConductLines().includes(' You were blind from birth.'));
    assert.ok(finalConductLines().includes(' You were deaf from birth.'));
});

test('temporary expiry and ordinary lenses cannot cure permanent blindness', () => {
    const state = initializeSenses({ blind: true, deaf: true });

    state.u.blindTurns = 20;
    state.u.deafTurns = 20;
    syncBlindness(state);
    syncDeafness(state);
    state.u.blindTurns = 0;
    state.u.deafTurns = 0;
    assert.equal(syncBlindness(state), true);
    assert.equal(syncDeafness(state), true);

    const ordinaryLenses = { otyp: LENSES };
    state.ublindf = state.u.ublindf = ordinaryLenses;
    assert.equal(blindfolded(state), false);
    assert.equal(blindnessBlocked(state), false);
    assert.equal(syncBlindness(state), true);
});

test('Eyes block but do not erase the permanent blindness source', () => {
    const state = initializeSenses({ blind: true });
    const eyes = {
        otyp: LENSES,
        oartifact: artifactByName('The Eyes of the Overworld').id,
    };

    state.ublindf = state.u.ublindf = eyes;
    assert.equal(blindnessBlocked(state), true);
    assert.equal(syncBlindness(state), false);
    assert.equal(state.u.permaBlind, true);
    assert.equal(state.u.uroleplay.blind, true);

    state.ublindf = state.u.ublindf = null;
    assert.equal(syncBlindness(state), true);
    assert.equal(state.u.permaBlind, true);
});

test('fresh permanent-blind/deaf startup owns live perception', async () => {
    await runSegment({
        seed: 9183,
        datetime: '20260829193000',
        nethackrc: [
            'OPTIONS=name:Senses,role:Tourist,race:human,gender:female,align:neutral',
            'OPTIONS=permablind,permadeaf,!autopickup,!legacy,!tutorial,pettype:none',
        ].join('\n'),
        moves: '.',
        storage: new Map(),
    });

    assert.equal(game.u.permaBlind, true);
    assert.equal(game.u.uroleplay.blind, true);
    assert.equal(game.u.uroleplay.deaf, true);
    assert.match(_statusLine2(), / Blind Deaf$/);
    const adjacentX = game.u.ux < 79 ? game.u.ux + 1 : game.u.ux - 1;
    assert.equal(couldsee(adjacentX, game.u.uy), true);
    assert.equal(cansee(adjacentX, game.u.uy), false);
});
