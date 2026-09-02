import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { heroGazeAttack, useHeroGaze } from '../js/hero_gaze.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
import { addMonster } from './support/monsters.js';

function installGazingHero(formName, hero = {}) {
    freshRoomWithPolymorphedHero(formName, {
        left: 2,
        right: 30,
        top: 4,
        bottom: 16,
        heroX: 10,
        heroY: 10,
        polymorph: {
            uen: 30,
            uenmax: 30,
            ...hero,
        },
    });
}

function gaze(options = {}) {
    return useHeroGaze({
        state: game,
        attack: heroGazeAttack(game),
        publish: async () => undefined,
        ...options,
    });
}

test('an umber hulk uses #monster to confuse a visible monster', async () => {
    installGazingHero('umber hulk');
    const jackal = addMonster({
        species: 'jackal',
        x: 11,
        y: 10,
    });
    await runMonsterAbilityCommand(' '.repeat(6));

    assert.equal(jackal.mconf, 1);
    assert.equal(game.u.uen, 15);
    assert.equal(game.context.move, 1);
});

test('a blind hero cannot use a gaze attack', async () => {
    installGazingHero('umber hulk', { blindTurns: 3 });
    addMonster({ species: 'jackal', x: 11, y: 10 });

    const result = await gaze();

    assert.equal(result.reason, 'blind');
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 30);
});

test('a pyrolisk fiery gaze burns a monster', async () => {
    installGazingHero('pyrolisk');
    const jackal = addMonster({
        species: 'jackal',
        x: 11,
        y: 10,
        hitPoints: 12,
    });

    await gaze({
        random: () => 19,
        rollDice: () => 4,
    });

    assert.equal(jackal.mhp, 8);
    assert.equal(game.u.uen, 15);
});

test('gazing at a floating eye can freeze the hero', async () => {
    installGazingHero('umber hulk');
    addMonster({
        species: 'floating eye',
        x: 11,
        y: 10,
        level: 2,
    });

    const result = await gaze({ rollDice: () => 9 });

    assert.equal(result.stopped, true);
    assert.equal(game._helplessTurns, 9);
    assert.equal(game._helplessReason, "frozen by a monster's gaze");
});
