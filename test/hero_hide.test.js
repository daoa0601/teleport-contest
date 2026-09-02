import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { STONING } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { useHeroHide } from '../js/hero_hide.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, ROCK } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';

async function useMonsterAbility() {
    pushKeys('monster\n');
    await rhack('#'.charCodeAt(0));
}

test('a trapper can hide on the floor', async () => {
    freshRoomWithPolymorphedHero('trapper');

    await useMonsterAbility();

    assert.equal(game.u.uundetected, 1);
    assert.equal(game.context.move, 1);
});

test('a snake needs an object to hide underneath', async () => {
    freshRoomWithPolymorphedHero('garter snake');

    await useMonsterAbility();

    assert.equal(game.u.uundetected, 0);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /nothing to hide under/);

    floorObject(ROCK, game.u.ux, game.u.uy);
    await useMonsterAbility();

    assert.equal(game.u.uundetected, 1);
    assert.equal(game.context.move, 1);
});

test('a hiding mimic is drawn as an object', async () => {
    freshRoomWithPolymorphedHero('small mimic');
    game.nhDisplay = new GameDisplay(null);

    await useMonsterAbility();
    await flush_screen(1);

    const cell = game.nhDisplay.grid[game.u.uy + 1][game.u.ux - 1];
    assert.equal(cell.ch, ']');
    assert.equal(game.context.move, 1);
});

test('hiding under petrifying corpses is fatal', async () => {
    freshRoomWithPolymorphedHero('garter snake');
    floorObject(CORPSE, game.u.ux, game.u.uy, {
        corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    });
    let death;

    const result = await useHeroHide({
        state: game,
        publish: async () => undefined,
        refresh: () => undefined,
        die: async details => {
            death = details;
            return true;
        },
    });

    assert.equal(result.spentTime, true);
    assert.equal(death.deathType, STONING);
    assert.match(death.killer, /hiding under a cockatrice corpse/);
});
