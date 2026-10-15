import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { flushPendingTopline, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { TOWEL } from '../js/object_data.js';
import { burnArmorByFire, waterDamageObject } from '../js/trap.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
async function towelFight(wetness) {
    freshObjectRoom();
    const monster = await createMonsterAt('minotaur', 11, 10, MM_NOGRP | NO_MINVENT);
    monster.mhp = monster.mhpmax = 200;
    const towel = await addInventoryObject(TOWEL, { spe: wetness });
    const input = resetInputState();
    installPagerInput(input, { expected: /towel|minotaur|hit|miss|bash/, limit: 20 });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    pushKeys(towel.invlet);
    await rhack('w'.charCodeAt(0));
    await flushPendingTopline();
    messages.length = 0;
    return { towel, messages };
}
void test('wetting a wielded dry towel makes its next attack an ordinary weapon attack', async () => {
    const { towel, messages } = await towelFight(0);
    await waterDamageObject(towel, [], game, { rollOne: () => 1, publish: plineWithContinuation });
    await rhack('l'.charCodeAt(0));
    await flushPendingTopline();
    assert.doesNotMatch(messages.join('\n'), /You begin bashing/);
});
void test('fire drying a wielded towel makes its next attack announce improvised bashing', async () => {
    const { towel, messages } = await towelFight(1);
    await burnArmorByFire(game.u, game, plineWithContinuation, [], limit => limit === 5 ? 1 : 0);
    assert.equal(towel.spe, 0);
    await rhack('l'.charCodeAt(0));
    await flushPendingTopline();
    assert.match(messages.join('\n'), /You begin bashing monsters with your towel\./);
});
void test('throwing a wet towel removes one unit of wetness before it lands', async () => {
    freshObjectRoom();
    const towel = await addInventoryObject(TOWEL, { spe: 2 });
    installPagerInput(resetInputState(), { expected: /towel/, limit: 10 });
    await throwInventoryObject(towel, '>');
    assert.equal(towel.spe, 1);
    assert.equal(game.inventory.includes(towel), false);
});
//# sourceMappingURL=towel_weapon_wetness.test.js.map