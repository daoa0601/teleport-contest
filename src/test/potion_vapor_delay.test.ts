import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithThrownPotion } from '../js/hero_potion_hit.js';
import { POT_PARALYSIS, POT_SLEEPING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const type of [POT_PARALYSIS, POT_SLEEPING]) {
    void test(`potion ${type} vapors preserve an existing longer paralysis`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game._helplessTurns = 30;
        const potion = await knownObject(type);

        await hitHeroWithThrownPotion(potion, { publish: async () => {} });

        assert.equal(game._helplessTurns, 30);
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(potion.where, 'gone');
    });
}

void test('paralysis vapors clear sleep when they replace a shorter delay', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._helplessTurns = 1;
    game.u.usleep = game.moves;
    game.u.invulnerable = true;
    const potion = await knownObject(POT_PARALYSIS);

    await hitHeroWithThrownPotion(potion, { publish: async () => {} });

    assert.equal(game.u.usleep, 0);
    assert.equal(game.u.invulnerable, false);
    assert.ok((game._helplessTurns ?? 0) >= 1 && (game._helplessTurns ?? 0) <= 5);
});
