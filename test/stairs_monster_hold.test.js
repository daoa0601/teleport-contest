import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';
for (const command of ['<', '>']) {
    for (const [species, swallowed, condition] of [
        ['large mimic', false, 'being held'],
        ['purple worm', true, 'swallowed'],
        ['air elemental', true, 'engulfed'],
    ]) {
        void test(`${command} spends a turn refusing travel while ${condition}`, async () => {
            const { source } = freshConnectedLevels();
            requirePlayingGame(game);
            assert.ok(game.stairs);
            game.stairs.up = command === '<';
            const holder = await createMonsterAt(species, 11, 10);
            game.u.ustuck = holder;
            game.u.uswallow = swallowed ? 1 : 0;
            installPagerInput(resetInputState(), { expected: /stairs|held|swallowed|engulfed/, limit: 2 });
            await rhack(command.charCodeAt(0));
            assert.ok(game.level === source, 'a monster holding the hero prevents departure');
            assert.ok(game.u.ustuck === holder, 'the holder keeps its grip');
            assert.equal(game.context.move, 1);
            assert.equal(game._pending_message, `You are ${condition}, and cannot go ${command === '<' ? 'up' : 'down'}.`);
        });
    }
}
void test('a sticky hero releases its captive before trying to descend elsewhere', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.stairs = null;
    installPolymorphedHero('large mimic');
    const captive = await createMonsterAt('newt', 11, 10);
    game.u.ustuck = captive;
    installPagerInput(resetInputState(), { expected: /You release the newt\./, limit: 1 });
    await rhack('>'.charCodeAt(0));
    assert.ok(game.level === source, 'the hero stays on this level');
    assert.equal(game.u.ustuck, null);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, "You can't go down here.");
});
//# sourceMappingURL=stairs_monster_hold.test.js.map