import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CORNUTHAUM, FEDORA, ROBE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, form, expected] of [
    [ROBE, 'fog cloud', /Your robe falls, unsupported!/],
    [FEDORA, 'newt', /Your hat falls to the floor!/],
    [FEDORA, 'minotaur', /Your horns pierce through your fedora named Traveler\./],
] as const) {
    void test(`polymorph describes the garment that a ${form} body sheds or pierces`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        const garment = await addInventoryObject(type, { oname: 'Traveler' });
        wearHeroArmor(garment);
        const input = resetInputState();
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        pushKeys(`polyself\n${form}\n                        `);

        await rhack('#'.charCodeAt(0));
        messages.push(game._pending_message);

        assert.match(messages.join('\n'), expected);
    });
}

void test('horns knock off an unfinished cloth hat rather than piercing it', async () => {
    freshObjectRoom({ role: 'wizard', flags: { debug: true } });
    const hat = await addInventoryObject(CORNUTHAUM);
    pushKeys(hat.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game.uarmh, hat);
    assert.equal(game._delayedAction?.object, hat);
    resetInputState();
    pushKeys('polyself\nminotaur\n                        ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.uarmh, null);
    assert.equal(hat.where, 'floor');
    assert.equal(game._delayedAction, null);
});
