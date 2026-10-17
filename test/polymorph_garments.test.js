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
]) {
    void test(`polymorph describes the garment that a ${form} body sheds or pierces`, async () => {
        freshObjectRoom({ flags: { debug: true } });
        const garment = await addInventoryObject(type, { oname: 'Traveler' });
        wearHeroArmor(garment);
        const input = resetInputState();
        const messages = [];
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
    assert.ok(game.multi < 0);
    resetInputState();
    pushKeys('polyself\nminotaur\n                        ');
    await rhack('#'.charCodeAt(0));
    assert.equal(game.uarmh, null);
    assert.equal(hat.where, 'floor');
    assert.equal(game.multi, 0);
});
void test('polymorph cancels dressing before the dropped-hat message waits for input', async () => {
    freshObjectRoom({ role: 'wizard', flags: { debug: true } });
    const robe = await addInventoryObject(ROBE);
    wearHeroArmor(robe);
    const hat = await addInventoryObject(CORNUTHAUM);
    pushKeys(hat.invlet);
    await rhack('W'.charCodeAt(0));
    const input = resetInputState();
    input.feed('polyself\nminotaur\n');
    const changing = rhack('#'.charCodeAt(0));
    try {
        await input.waitUntilBlocked();
        assert.match(game._pending_message, /You turn into a (?:male |female )?minotaur!/);
        assert.equal(game.multi, 0);
    }
    finally {
        input.feed('                        ');
        await changing;
    }
});
//# sourceMappingURL=polymorph_garments.test.js.map