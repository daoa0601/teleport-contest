import assert from 'node:assert/strict';
import test from 'node:test';
import { M_SEEN_DISINT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { useHeroBreath } from '../js/hero_breath_command.js';
import { pushKeys } from '../js/input.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('monsters learn when the hero resists its own disintegration breath', async () => {
    freshObjectRoom({ hero: { uen: 50, uenmax: 50 } });
    requirePlayingGame(game);
    installPolymorphedHero('black dragon');
    const jackal = await createMonsterAt('jackal', 11, 10);
    pushKeys('.');
    const breath = await useHeroBreath();
    assert.equal(breath.spentTime, true);
    assert.ok((jackal.seen_resistance ?? 0) & M_SEEN_DISINT);
    assert.equal(game.u.uen, 35);
    assert.equal(game._pending_message, 'You are not disintegrated.');
});
//# sourceMappingURL=zap_disintegration_knowledge.test.js.map