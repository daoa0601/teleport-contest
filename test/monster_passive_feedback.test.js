import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { applyMonsterContactPassive } from '../js/monster_contact_passive.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const species of ['acid blob', 'gelatinous cube']) {
    void test(`an unseen ${species} is not identified by its passive retaliation`, async () => {
        freshObjectRoom();
        const attacker = await createMonsterAt('orc', 11, 10, NO_MINVENT);
        const defender = await createMonsterAt(species, 12, 10, NO_MINVENT);
        defender.minvis = true;
        const messages = [];
        await applyMonsterContactPassive(attacker, defender, {
            state: game, hit: true, rollDice: count => count,
            random: limit => limit === 2 ? 0 : 1,
            publish: message => { messages.push(message); },
        });
        assert.ok(messages.includes(species === 'acid blob'
            ? 'The orc is splashed by its acid!'
            : 'The orc is frozen by it.'), messages.join('\n'));
        assert.equal(messages.some(message => message.includes(species)), false);
    });
}
void test('hallucination changes the perceived liquid in an acid passive splash', async () => {
    freshObjectRoom({ hero: { hallucinationTurns: 20 }, gameplaySeed: 18n });
    const attacker = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    const defender = await createMonsterAt('acid blob', 12, 10, NO_MINVENT);
    attacker.mhp = attacker.mhpmax = 100;
    const splashes = [];
    for (let splash = 0; splash < 8; splash++) {
        await applyMonsterContactPassive(attacker, defender, {
            state: game, hit: true, rollDice: count => count,
            random: limit => limit === 2 ? 0 : 1,
            publish: message => { if (message.includes('is splashed by'))
                splashes.push(message); },
        });
    }
    assert.equal(splashes.length, 8);
    assert.ok(splashes.some(message => !message.endsWith(' acid!')), splashes.join('\n'));
});
//# sourceMappingURL=monster_passive_feedback.test.js.map