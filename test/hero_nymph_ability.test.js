import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { TT_BURIEDBALL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { useHeroNymphAbility } from '../js/hero_nymph_ability.js';
import { pushKeys } from '../js/input.js';
import {
    freshRoomWithPolymorphedHero, installPunishedHero,
} from './support/hero-state.js';

function installNymphHero() {
    freshRoomWithPolymorphedHero('water nymph');
}

test('a nymph uses #monster to remove her ball and chain', async () => {
    installNymphHero();
    const { ball, chain } = installPunishedHero();
    const pile = game.level.objects[game.u.ux][game.u.uy];
    pushKeys('monster\n');

    await rhack('#'.charCodeAt(0));

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
        installNymphHero();
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
    installNymphHero();
    const messages = [];

    const result = await useHeroNymphAbility({
        state: game,
        publish: async message => messages.push(message),
    });

    assert.equal(result.spentTime, false);
    assert.deepEqual(messages, ['You are not chained to anything!']);
});
