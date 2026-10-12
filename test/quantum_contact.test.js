import test from 'node:test';
import assert from 'node:assert/strict';
import { performMonsterHeroAttack } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a cancelled quantum mechanic still hits and reports that teleportation was negated', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    const mechanic = await createMonsterAt('quantum mechanic', 11, 10, NO_MINVENT);
    mechanic.mpeaceful = 0;
    mechanic.mcan = 1;
    mechanic.mux = 10;
    mechanic.muy = 10;
    await performMonsterHeroAttack(mechanic, game, { rollOne: () => 1, rollDice: () => 3 });
    assert.match(game._pending_message, /The quantum mechanic hits!  You are not affected\./);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.uhp, 37);
});
for (const halfPhysicalDamage of [false, true]) {
    void test(`a quantum-mechanic hit preserves one HP with ${halfPhysicalDamage ? 'half' : 'full'} physical damage even when teleport is restricted`, async () => {
        const level = freshObjectRoom({
            flags: { verbose: true }, hero: { uhp: 1, uhpmax: 40, halfPhysicalDamage },
        });
        requirePlayingGame(game);
        level.flags.noteleport = true;
        const mechanic = await createMonsterAt('quantum mechanic', 11, 10, NO_MINVENT);
        mechanic.mpeaceful = 0;
        mechanic.mux = 10;
        mechanic.muy = 10;
        installPagerInput(resetInputState(), { expected: /hits|uncertain|mysterious force/, limit: 4 });
        await performMonsterHeroAttack(mechanic, game, {
            random: limit => limit - 1, rollOne: () => 1, rollDice: () => 3,
        });
        assert.equal(game.u.uhp, 1);
        assert.ok(!game.program_state.gameover);
        assert.equal(game.u.ux, 10);
        assert.match(game._pending_message, /uncertain|mysterious force/);
    });
}
//# sourceMappingURL=quantum_contact.test.js.map