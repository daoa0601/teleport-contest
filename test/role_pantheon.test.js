import assert from 'node:assert/strict';
import test from 'node:test';
import { hallucinatedDeityName } from '../js/alignment.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { roles } from '../js/roles.js';
import { freshObjectRoom } from './support/object-room.js';
function hallucinatedGods(role) {
    freshObjectRoom({ role, gameplaySeed: 47n });
    requirePlayingGame(game);
    if (role === 'priest') {
        const pantheon = roles.find(candidate => candidate.key === 'rogue');
        assert.ok(pantheon?.gods);
        game.urole = { ...game.urole, gods: { ...pantheon.gods } };
    }
    return Array.from({ length: 128 }, () => hallucinatedDeityName(-1, game, true));
}
void test('a Priest borrowing gods does not change hallucinated god choices', () => {
    const ordinary = hallucinatedGods('rogue');
    const borrowed = hallucinatedGods('priest');
    for (let index = 0; index < ordinary.length; index++)
        assert.equal(borrowed[index], ordinary[index], `hallucinated god ${index + 1} must use the source role table`);
});
//# sourceMappingURL=role_pantheon.test.js.map