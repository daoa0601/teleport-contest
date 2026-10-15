import assert from 'node:assert/strict';
import test from 'node:test';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const species of ['goblin', 'giant eel']) {
    void test(`an underwater hero ${species === 'goblin' ? 'cannot be attacked by a nonswimmer' : 'can be bitten by a swimmer'}`, async () => {
        const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = POOL;
        const monster = await createMonsterAt(species, 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mcan = 1;
        monster.mux = game.u.ux;
        monster.muy = game.u.uy;
        game.u.uinwater = 1;
        installPagerInput(resetInputState(), { expected: /eel|goblin/, limit: 8 });

        await performMonsterHeroAttack(monster, game, {
            random: range => range - 1, rollOne: () => 1, rollDice: count => count,
        });

        assert.equal(game.u.uhp, species === 'goblin' ? 100 : 97);
    });
}

for (const prayer of [false, true]) {
    void test(`a swallower ${prayer ? 'leaves a praying hero alone' : 'always knows where its swallowed hero is'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        const cloud = await createMonsterAt('fog cloud', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        game.u.invulnerable = prayer;
        if (prayer) {
            game.multi = -3;
            game._helplessTurns = 3;
        }
        cloud.mx = game.u.ux;
        cloud.my = game.u.uy;
        cloud.mux = 15;
        cloud.muy = 10;
        game.u.uswallow = 1;
        game.u.ustuck = cloud;
        game.u.uswldtim = 5;
        installPagerInput(resetInputState(), { expected: /moisture/, limit: 5 });

        await performMonsterHeroAttack(cloud, game, {
            random: range => range - 1, rollOne: () => 1, rollDice: count => count,
        });

        assert.equal(game.u.uhp, prayer ? 100 : 99);
        assert.equal(game.u.uswldtim, prayer ? 5 : 4);
        assert.equal(cloud.mux, game.u.ux);
        assert.equal(cloud.muy, game.u.uy);
        assert.doesNotMatch(game._pending_message, /loosens its grip/);
    });
}
