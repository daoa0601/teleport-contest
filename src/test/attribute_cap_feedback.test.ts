import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { A_STR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES, POT_GAIN_ABILITY } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('gain ability describes a Strength cap imposed by an opposing equipment bonus as current', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    requirePlayingGame(game);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 118;
    await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: -5 }), 'uleft');
    const potion = await addInventoryObject(POT_GAIN_ABILITY, { blessed: true });
    const messages: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${potion.invlet}${' '.repeat(60)}`);

    await rhack('q'.charCodeAt(0));

    messages.push(game._pending_message);
    assert.equal(game.u.acurr.a[A_STR], 118);
    assert.match(messages.join('\n'), /You're currently as strong as you can get\./);
});
