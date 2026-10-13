import test from 'node:test';
import assert from 'node:assert/strict';
import { PARANOID_PRAY } from '../js/const.js';
import { clearMessageWindow } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hitHeroWithThrownPotion } from '../js/hero_potion_hit.js';
import { POT_PARALYSIS, POT_SLEEPING } from '../js/object_data.js';
import { finishPrayerOccupation } from '../js/pray.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { type, name } of [{ type: POT_PARALYSIS, name: 'paralysis' },
    { type: POT_SLEEPING, name: 'sleeping' }]) {
    void test(`potion of ${name} vapors preserve an existing longer paralysis`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        game._helplessTurns = 30;
        const potion = await knownObject(type);

        await hitHeroWithThrownPotion(potion, { publish: async () => {} });

        assert.equal(game._helplessTurns, 30);
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(potion.where, 'gone');
    });

    void test(`shorter ${name} vapors preserve protection during prayer`, async () => {
        freshObjectRoom({
            flags: { paranoia_bits: PARANOID_PRAY },
            hero: { uhp: 20, ublesscnt: 0, uluck: 0, ugangr: 0,
                ualign: { type: 0, record: 10 } },
        });
        requirePlayingGame(game);
        const potion = await knownObject(type);
        await runExtendedCommand('pray', 'y\x1b');
        assert.equal(game.u.invulnerable, true);
        // This impact produces a one-turn vapor delay, shorter than prayer.
        initRng(1n);

        await hitHeroWithThrownPotion(potion, { publish: async () => {} });

        assert.equal(game.u.invulnerable, true);
        assert.equal(game._prayerTurnsRemaining, 3);
        assert.equal(game._helplessTurns ?? 0, 0);
        assert.equal(potion.where, 'gone');
    });

    void test(`prayer completes with movement recovery after shorter ${name} vapors`, async () => {
        freshObjectRoom({
            flags: { paranoia_bits: PARANOID_PRAY },
            hero: { ublesscnt: 0, uluck: 0, ugangr: 0,
                ualign: { type: 0, record: 10 } },
        });
        requirePlayingGame(game);
        const potion = await knownObject(type);
        await runExtendedCommand('pray', 'y ');
        clearMessageWindow();
        initRng(1n);

        await hitHeroWithThrownPotion(potion, { publish: async () => {} });
        await finishPrayerOccupation();

        const messages = game._pending_message;
        assert.match(messages, /You can move again\./);
        assert.doesNotMatch(messages, /You finish your prayer\./);
        assert.equal(game.u.invulnerable, false);
        assert.ok(game.u.ublesscnt > 0, 'The preserved prayer still receives its divine response.');
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
