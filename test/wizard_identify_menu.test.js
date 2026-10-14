import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { objectNeedsFullIdentification } from '../js/invent.js';
import { POT_HEALING, SCR_IDENTIFY } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const selector of ['_', '\x09', '!']) {
    void test(`wizard identify can permanently identify all items with ${JSON.stringify(selector)}`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        requirePlayingGame(game);
        const potion = await addInventoryObject(POT_HEALING, { invlet: 'a', known: false, bknown: false });
        const scroll = await addInventoryObject(SCR_IDENTIFY, { invlet: 'b', known: false, bknown: false });
        const input = resetInputState();
        installPagerInput(input, { expected: /potion|scroll/, limit: 4 });
        if (selector === '!')
            applyNethackrc('BIND=!:wizidentify');
        if (selector === '!') {
            input.feed(`${selector}\n`);
            await rhack('!'.charCodeAt(0));
        }
        else
            await runExtendedCommand('wizidentify', `${selector}\n`);
        assert.equal(objectNeedsFullIdentification(potion), false);
        assert.equal(objectNeedsFullIdentification(scroll), false);
        assert.equal(game.context.move, 0);
    });
}
void test('wizard identify with an empty inventory reports that nothing is carried', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const input = resetInputState();
    input.feed('\x1b');
    await rhack(9);
    assert.equal(game._pending_message, 'Not carrying anything.');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_identify_menu.test.js.map