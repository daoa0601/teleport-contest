import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { BEAR_TRAP, LEVEL_TELEP, NO_MINVENT, TELEP_TRAP } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { monsterKnowsTrap, monsterLearnsTrap } from '../js/trap_knowledge.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('wizard teleport through a seen random teleport trap takes time without costing nutrition', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    addTrap(level, TELEP_TRAP, 10, 10, { tseen: true });
    const hunger = game.u.uhunger;
    const input = resetInputState();
    const choices = [...'l.'];
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--'))
                return ' '.charCodeAt(0);
            if (choices.length === 2)
                assert.match(screen, /Where do you want to be teleported/);
            const choice = choices.shift();
            assert.ok(choice, 'Teleport must finish after a destination is chosen');
            return choice.charCodeAt(0);
        },
    };
    await rhack(20);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.context.move, 1);
});
void test('Ctrl-T deliberately triggers a level teleporter without teaching nearby monsters about it', async () => {
    const level = freshObjectRoom({ flags: { debug: true, tips: false, verbose: false } });
    requirePlayingGame(game);
    const trap = addTrap(level, LEVEL_TELEP, 10, 10, { tseen: true });
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    monsterLearnsTrap(goblin, { ttyp: BEAR_TRAP });
    const hunger = game.u.uhunger;
    let reads = 0;
    resetInputState().display = {
        async readKey() {
            assert.ok(++reads <= 5, 'Deliberate trap activation must finish after cancelling the level prompt');
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('--More--'))
                return 32;
            if (screen.includes('Trigger it?'))
                return 'y'.charCodeAt(0);
            assert.match(screen, /To what level do you want to teleport\?/);
            return 27;
        },
    };
    await rhack(20);
    assert.equal(monsterKnowsTrap(goblin, trap), false, 'A deliberate jump bypasses dotrap() and its observer knowledge update');
    assert.equal(monsterKnowsTrap(goblin, { ttyp: BEAR_TRAP }), true, 'The monster retains knowledge of other traps');
    assert.equal(level.traps.includes(trap), false);
    assert.equal(game.u.confusionTurns, 3);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.context.move, 1, 'Deliberately triggering the trap takes time even after cancellation');
});
//# sourceMappingURL=wizard_teleport_trap.test.js.map