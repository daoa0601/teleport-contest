import type { RoleKey, RaceName } from '../js/roles.js';
import type { GameState } from '../js/game_state.js';
import { createRoomLevel } from './support/playable-room.js';
import { capturedScreen } from './support/screen.js';
import { memoryStorage } from './support/memory-storage.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { ROOM } from '../js/const.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { game } from '../js/gstate.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { currentConductLines, finalConductLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import {
    FLINT, FOOD_RATION, POT_WATER, SACK, SPE_FORCE_BOLT, SPE_HEALING,
    SPE_PROTECTION, TOUCHSTONE, WAN_WISHING,
} from '../js/object_data.js';
import { parseNethackrc } from '../js/options.js';
import { roles } from '../js/roles.js';
import { makedog } from '../js/u_init.js';
import {
    completeHeroStartup, prepareHeroStartup,
} from './support/startup.js';


async function start(roleKey: RoleKey, raceName: RaceName = 'human', flags: GameState['flags'] = { pauper: true }) {
    const state = await completeHeroStartup({ role: roleKey, race: raceName, flags });
    requireStartingKnowledge(state);
    return state;
}

function requireStartingKnowledge(state: GameState): asserts state is GameState & { _knownObjectTypes: Set<number> } {
    assert.ok(state._knownObjectTypes);
}

void test('pauper implies nudist at its option position and allows later override', () => {
    const overridden = parseNethackrc('OPTIONS=!nudist,pauper').flags;
    assert.equal(overridden.pauper, true);
    assert.equal(overridden.nudist, false);

    const implied = parseNethackrc('OPTIONS=pauper,!nudist').flags;
    assert.equal(implied.pauper, true);
    assert.equal(implied.nudist, true);
});

void test('every pauper role starts empty, untrained, and selectively preknown', async () => {
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
        const state = await start(role.key, 'human', {
            pauper: true, nudist: true, explore: true,
        });
        assert.deepEqual(state.inventory, [], role.key);
        assert.deepEqual(state.spells, [], role.key);
        assert.equal(heroGoldAmount(state), 0, role.key);
        // Native umoney0 records the role's starting allowance even when
        // pauper suppresses ini_inv(Money) and leaves the purse empty.
        if (role.key === 'healer') {
            assert.ok((state._initialGoldCount ?? 0) >= 1001
                && (state._initialGoldCount ?? 0) <= 2000);
        } else if (role.key === 'tourist') {
            assert.ok((state._initialGoldCount ?? 0) >= 1
                && (state._initialGoldCount ?? 0) <= 1000);
        } else {
            assert.equal(state._initialGoldCount, 0, role.key);
        }
        assert.equal(state.u.weapon_slots, 2, role.key);
        assert.ok(state.u.weaponSkills != null, 'Expected state.u.weaponSkills to be initialized');
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

    }
});

void test('pauper suppresses race inventory and knowledge but retains override', async () => {
    const elfWizard = await start('wizard', 'elf', { pauper: true });
    assert.deepEqual([...elfWizard._knownObjectTypes], [SPE_FORCE_BOLT]);
    assert.deepEqual(elfWizard.inventory, []);

    const orcRanger = await start('ranger', 'orc', { pauper: true });
    assert.deepEqual([...orcRanger._knownObjectTypes], []);
    assert.deepEqual(orcRanger.inventory, []);

    const priest = await start('priest', 'human', { pauper: true });
    assert.deepEqual(
        [...priest._knownObjectTypes],
        [POT_WATER, SPE_PROTECTION],
    );
});

void test('standalone nudist constructs no hero armor without becoming pauper', async () => {
    const state = await start('knight', 'human', {
        pauper: false, nudist: true,
    });

    assert.ok(state.inventory.length > 0);
    assert.equal(state.inventory.some(object => object.oclass === 3), false);
    assert.ok(state.inventory.some(object => object.oclass === 2));
    assert.ok(state.inventory.some(object => object.oclass === 7));
    assert.ok(state.u.weaponSkills != null, 'Expected state.u.weaponSkills to be initialized');
    assert.ok(state.u.weaponSkills.some(skill => skill.skill > 1));
    assert.equal(state.u.weapon_slots, 0);
});

async function startingPony(pauper: boolean) {
    prepareHeroStartup({
        role: 'knight',
        alignment: 'lawful',
        flags: { pauper },
        seed: 456n,
    });
    game.u.ux = 40;
    game.u.uy = 10;
    game.level = createRoomLevel({ left: 1, right: 78, top: 1, bottom: 19 });
    return await makedog();
}

void test('pauper Knight keeps the pony but suppresses its starting saddle', async () => {
    const pauperPony = await startingPony(true);
    assert.ok(pauperPony);
    assert.equal(pauperPony.saddled, undefined);
    assert.equal(pauperPony.saddle, undefined);

    const ordinaryPony = await startingPony(false);
    assert.ok(ordinaryPony != null, 'Expected ordinaryPony to be initialized');
    assert.equal(ordinaryPony.saddled, true);
    assert.ok(ordinaryPony.saddle);
});

void test('conduct disclosure projects pauper and implied nudist state', async () => {
    const state = await start('wizard');
    state.u.uconduct = {};
    assert.ok(currentConductLines().includes(' You are without possessions.'));
    assert.ok(currentConductLines().includes(' You have been faithfully nudist.'));
    assert.ok(finalConductLines().includes(' You started out without possessions.'));
    assert.ok(finalConductLines().includes(' You were faithfully nudist.'));
});

void test('fresh pauper startup uses the untrained legacy page', async () => {
    const result = await runSegment({
        seed: 123,
        datetime: '20260829134500',
        nethackrc: 'OPTIONS=name:Pauper,role:Wizard,race:human,'
            + 'gender:male,align:neutral,pauper,legacy,!tutorial,pettype:none',
        moves: ' ',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);
    const screen = decodeScreen(capturedScreen(result, 0))
        .map(row => row.map(cell => cell.ch).join('')).join('\n');

    assert.match(screen, /You, an untrained Evoker, have been unable/);
    assert.match(screen, /prepare to be the instrument of Thoth/);
    assert.deepEqual(game.inventory, []);
    assert.ok(game._knownObjectTypes);
    assert.deepEqual([...game._knownObjectTypes], [SPE_FORCE_BOLT]);
    assert.equal(game.u.weapon_slots, 2);
});
