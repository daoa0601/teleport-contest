import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { resolveDeferredMonsterBreath, runMonsterAction } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('invalid hero-directed breath reports the bad type without launching a ray', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10, hero: { uhp: 100, uhpmax: 100 } });
    requirePlayingGame(game);
    const dragon = await createMonsterAt('red dragon', 10, 10, MM_ANGRY | NO_MINVENT);
    dragon.mux = game.u.ux;
    dragon.muy = game.u.uy;
    const action = await runMonsterAction(dragon, game, () => 1, () => 1, () => 1);
    assert.ok(action.movement, 'The dragon must have a movement action.');
    const attack = action.movement.heroAttackSequence?.current;
    assert.ok(attack?.kind === 'hero-breath' && attack.breath.launched, 'The dragon must have selected a breath attack.');
    const breath = { ...attack.breath, damageType: AD_PHYS };
    game.multi = 7;
    const health = game.u.uhp;
    const cooldown = dragon.mspec_used;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => {
        messages.push(game._pending_message);
        input.feed(' ');
    };
    await resolveDeferredMonsterBreath(action, breath, game, async (message) => { messages.push(message); }, () => 1, () => 1, () => 1);
    messages.push(game._pending_message);
    assert.ok(messages.some(message => message.includes('Breath weapon -1 used')), `Expected the invalid breath diagnostic; received: ${messages.join(' | ')}`);
    assert.equal(messages.some(message => message.includes(' breathes ')), false);
    assert.equal(game.u.uhp, health);
    assert.equal(game.multi, 7);
    assert.equal(dragon.mspec_used, cooldown);
});
//# sourceMappingURL=monster_breath_invalid.test.js.map