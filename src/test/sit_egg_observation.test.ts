import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { EGG } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a hallucinating egg layer knows its egg without identifying its appearance', async () => {
    const level = freshObjectRoom({ flags: { female: true }, hero: { hallucinationTurns: 30 } });
    requirePlayingGame(game);
    installPolymorphedHero('cockatrice');
    const hunger = game.u.uhunger;

    await runExtendedCommand('sit', ' '.repeat(10));

    const egg = level.objects[10]?.[10]?.find(object => object.otyp === EGG);
    assert.ok(egg);
    assert.equal(egg.known, true);
    assert.equal(egg.dknown, false);
    assert.equal(game._encounteredObjectTypes?.has(EGG) ?? false, false);
    assert.ok(game.u.uhunger < hunger);
    assert.equal(game.context.move, 1);
});

void test('a hallucinating male egg layer gets the platypus refusal without spending a turn', async () => {
    freshObjectRoom({ flags: { female: false }, hero: { hallucinationTurns: 30 } });
    installPolymorphedHero('cockatrice');

    await runExtendedCommand('sit');

    assert.equal(game._pending_message, 'You may think you are a platypus, but a male still can\'t lay eggs!');
    assert.equal(game.context.move, 0);
});
