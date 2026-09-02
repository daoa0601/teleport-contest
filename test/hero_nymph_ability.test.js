import test from 'node:test';
import assert from 'node:assert/strict';

import { TT_BURIEDBALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { useHeroNymphAbility } from '../js/hero_nymph_ability.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import {
    freshRoomWithPolymorphedHero, installPunishedHero,
} from './support/hero-state.js';

test('a nymph uses #monster to remove her ball and chain', async () => {
    freshRoomWithPolymorphedHero('water nymph');
    const { ball, chain } = installPunishedHero();
    const pile = game.level.objects[game.u.ux][game.u.uy];
    await runMonsterAbilityCommand();

    assert.equal(game.context.move, 1);
    assert.equal(game.u.punished, false);
    assert.equal(game.uball, null);
    assert.equal(game.uchain, null);
    assert.equal(pile.includes(ball), true);
    assert.equal(pile.includes(chain), false);
    assert.equal(chain.where, 'gone');
});

test('an unchained nymph reports the buried ball without spending time',
    async () => {
        freshRoomWithPolymorphedHero('water nymph');
        game.u.utrap = 3;
        game.u.utraptype = TT_BURIEDBALL;
        const messages = [];

        const result = await useHeroNymphAbility({
            state: game,
            publish: async message => messages.push(message),
        });

        assert.equal(result.spentTime, false);
        assert.deepEqual(messages, [
            'The ball and chain are buried firmly in the floor.',
        ]);
    });

test('an unpunished nymph has no chain to remove', async () => {
    freshRoomWithPolymorphedHero('water nymph');
    const messages = [];

    const result = await useHeroNymphAbility({
        state: game,
        publish: async message => messages.push(message),
    });

    assert.equal(result.spentTime, false);
    assert.deepEqual(messages, ['You are not chained to anything!']);
});
