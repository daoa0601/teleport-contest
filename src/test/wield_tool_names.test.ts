import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { setTopline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OIL_LAMP } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a welded weapon refusal names the lamp the hero tried to rub', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const dagger = await addInventoryObject(DAGGER, { cursed: true });
    const lamp = await addInventoryObject(OIL_LAMP, { oname: 'Night Light' });
    await setPrimaryWeapon(dagger);
    const input = resetInputState();
    // Direct rhack() calls skip parse()'s clear before a fresh command.
    await setTopline('');

    await answerPrompts(runExtendedCommand('rub', lamp.invlet), input, [{
        prompt: /Since your weapon is welded to your hand, you cannot rub that oil lamp named\s+Night Light\.\s*--More--/,
        keys: ' ',
    }]);
    assert.equal(game.uwep, dagger);
    assert.equal(game.context.move, 0);
});

for (const [name, quantity, phrase] of [
    ['Rays OF Dawn', 1, 'those oil lamp'],
    ['PAIR OF LAMPS', 2, 'that oil lamps'],
] as const) {
    void test(`tool refusal treats plural wording in "${name}" without regard to case`, async () => {
        freshObjectRoom({ flags: { verbose: true } });
        const dagger = await addInventoryObject(DAGGER, { cursed: true });
        await setPrimaryWeapon(dagger);
        const lamp = await addInventoryObject(OIL_LAMP, { oname: name, quan: quantity });
        const input = resetInputState();
        await setTopline('');

        await answerPrompts(runExtendedCommand('rub', lamp.invlet), input, [{
            prompt: /you cannot rub /,
            keys: ' ',
        }]);

        assert.equal(game._lastPlineMessage,
            `Since your weapon is welded to your hand, you cannot rub ${phrase} named ${name}.`);
        assert.equal(game.uwep, dagger);
        assert.equal(game.context.move, 0);
    });
}
