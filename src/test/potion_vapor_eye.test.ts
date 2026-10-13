import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithThrownPotion } from '../js/hero_potion_hit.js';
import { POT_RESTORE_ABILITY } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('cursed ability vapors sting a breathless gas spore in its optic nerves', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('gas spore');
    const potion = await knownObject(POT_RESTORE_ABILITY, { cursed: true });
    const messages: string[] = [];

    await hitHeroWithThrownPotion(potion, { publish: async message => { messages.push(message); } });

    assert.ok(messages.includes('Your optic nerves sting!'), messages.join(' | '));
});

