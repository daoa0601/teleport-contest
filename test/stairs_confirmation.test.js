import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { advanceLevitationTimeout } from '../js/levitation_timeout.js';
import { ORCISH_DAGGER, POT_LEVITATION } from '../js/object_data.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { createSpecialLevel } from './support/topology.js';
import { installPagerInput } from './support/pager-input.js';
import { answerPrompts } from './support/input-boundaries.js';
void test('the first dungeon exit asks for confirmation before climbing', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    assert.ok(game.stairs);
    game.stairs.up = true;
    const input = resetInputState();
    await answerPrompts(rhack('<'.charCodeAt(0)), input, [
        { prompt: /Beware, there will be no return!  Still climb\?/, keys: 'n' },
    ]);
    assert.ok(game.level === source, 'declining the exit leaves the level untouched');
    assert.equal(game.context.move, 0);
    assert.equal(game.stairs.u_traversed, false);
});
void test('declining entry to Gehennom keeps its gate closed', async () => {
    const { source } = freshConnectedLevels();
    requirePlayingGame(game);
    game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1 });
    const input = resetInputState();
    installPagerInput(input, {
        expected: /standing at the gate to Gehennom|Unspeakable cruelty and harm/,
        limit: 2,
    });
    const pager = input.display;
    let asked = false;
    input.display = { async readKey() {
            if (game._pending_message.includes('Are you sure you want to enter?')) {
                asked = true;
                return 'n'.charCodeAt(0);
            }
            assert.ok(pager);
            return pager.readKey();
        } };
    await rhack('>'.charCodeAt(0));
    assert.equal(asked, true, 'the Valley gate asks before departure');
    assert.ok(game.level === source);
    assert.equal(game.u.uevent?.gehennom_entered ?? 0, 0);
    assert.equal(game.context.move, 0);
});
void test('a menu-prefixed cursed levitation climb leaves the landing unpicked', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    assert.ok(game.stairs);
    game.stairs.up = true;
    game.stairs.tolev = { dnum: 0, dlevel: 0 };
    await floorObject(ORCISH_DAGGER, game.u.ux, game.u.uy);
    const potion = await addInventoryObject(POT_LEVITATION, { cursed: true });
    const messages = [];
    const input = resetInputState();
    input.feed(`q${potion.invlet}`);
    await answerPrompts(rhack('m'.charCodeAt(0)), input, [
        { prompt: /You start to float in the air!/, keys: ' ' },
        { prompt: /Beware, there will be no return!  Still climb\?/, keys: '\u001b' },
    ]);
    game._pending_message = '';
    input.display = {
        async readKey() {
            messages.push(game._pending_message ?? '');
            return ' '.charCodeAt(0);
        },
    };
    // The cursed potion's one-turn levitation ends before the next command.
    await advanceLevitationTimeout(game);
    messages.push(game._pending_message ?? '');
    const shown = messages.join(' ');
    assert.match(shown, /You float gently to the stairs\./);
    // C doup()'s set_move_cmd() kept the menu prefix's no-pickup request.
    assert.doesNotMatch(shown, /here/);
});
//# sourceMappingURL=stairs_confirmation.test.js.map