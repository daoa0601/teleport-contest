import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a blind eyeless hero feels the throne sight reward in its current anatomy', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    installPolymorphedHero('gelatinous cube');
    setHeroBlindnessTurns(30);
    initRng(34n);

    await runExtendedCommand('sit', ' '.repeat(10));

    assert.match(game._pending_message, /very strange feeling in your cerebral area/);
});
