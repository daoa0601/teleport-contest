import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { POT_LEVITATION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
void test('a stalker hits its head when cursed levitation throws it into the ceiling', async () => {
    freshRoomWithPolymorphedHero('stalker');
    const potion = await addInventoryObject(POT_LEVITATION, { cursed: true });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(`${potion.invlet}                        `);
    await rhack('q'.charCodeAt(0));
    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /You hit your head on the ceiling\./);
});
//# sourceMappingURL=polymorph_stalker_anatomy.test.js.map