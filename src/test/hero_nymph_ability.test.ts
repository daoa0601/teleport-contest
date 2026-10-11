import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { TT_BURIEDBALL } from '../js/const.js';
import { requireGameLevel, game } from '../js/gstate.js';
import { useHeroNymphAbility } from '../js/hero_nymph_ability.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import {
    freshRoomWithPolymorphedHero, installPunishedHero,
} from './support/hero-state.js';

void test('a nymph uses #monster to remove her ball and chain', async () => {
    freshRoomWithPolymorphedHero('water nymph');
    requireFixtureGame(game);
    const { ball, chain } = await installPunishedHero();
    const pile = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy);
    await runMonsterAbilityCommand();

    assert.equal(game.context.move, 1);
    assert.equal(game.u.punished, false);
    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
    assert.equal(pile.includes(ball), true);
    assert.equal(pile.includes(chain), false);
    assert.equal(chain.where, 'gone');
});

void test('an unchained nymph reports the buried ball without spending time',
    async () => {
        freshRoomWithPolymorphedHero('water nymph');
        requireFixtureGame(game);
        game.u.utrap = 3;
        game.u.utraptype = TT_BURIEDBALL;
        const messages: string[] = [];

        const result = await useHeroNymphAbility({
            state: game,
            publish: async (message: string) => messages.push(message),
        });

        assert.equal(result.spentTime, false);
        assert.deepEqual(messages, [
            'The ball and chain are buried firmly in the floor.',
        ]);
    });

void test('an unpunished nymph has no chain to remove', async () => {
    freshRoomWithPolymorphedHero('water nymph');
    requireFixtureGame(game);
    const messages: string[] = [];

    const result = await useHeroNymphAbility({
        state: game,
        publish: async (message: string) => messages.push(message),
    });

    assert.equal(result.spentTime, false);
    assert.deepEqual(messages, ['You are not chained to anything!']);
});
