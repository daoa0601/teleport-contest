import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroFormPassive } from '../js/hero_form_passive.js';
import { AT_BITE } from '../js/monster_attack_types.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
void test('an hallucinating acid-blob hero perceives changing liquids in its acid splash', async () => {
    const liquids = new Set();
    for (let seed = 1; seed <= 8; seed++) {
        freshRoomWithPolymorphedHero('acid blob', { gameplaySeed: seed,
            hero: { hallucinationTurns: 20 } });
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        dog.mhp = dog.mhpmax = 100;
        await applyHeroFormPassive(dog, game.u.umonnum, AT_BITE, {
            state: game, random: range => range === 2 ? 0 : range - 1,
            rollDice: () => 1,
            publish: async (message) => {
                const liquid = /is splashed by your (.+)!/.exec(message)?.[1];
                if (liquid)
                    liquids.add(liquid);
            },
        });
    }
    assert.ok(liquids.size > 1, 'Hallucination changes the perceived acid rather than always calling it acid');
});
//# sourceMappingURL=monster_hero_passive_liquid.test.js.map