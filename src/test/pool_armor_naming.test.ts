import assert from 'node:assert/strict';
import test from 'node:test';

import { wearHeroArmor } from '../js/armor.js';
import { RUST_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { ROBE, MUMMY_WRAPPING, RING_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { burnHeroArmorByFire } from '../js/trap.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, name] of [[ROBE, 'robe'], [MUMMY_WRAPPING, 'wrapping']] as const) {
    void test(`fire describes a worn ${name} by its simple armor name`, async () => {
        freshObjectRoom();
        const cloak = await addInventoryObject(type);
        await wearHeroArmor(cloak);
        const messages: string[] = [];

        await burnHeroArmorByFire(game, text => { messages.push(text); }, [], () => 1);

        assert.equal(messages[0], `Your ${name} smoulders!`);
        assert.equal(cloak.oeroded, 1);
    });
}

void test('a rust trap calls a worn ring mail suit mail', async () => {
    const level = freshObjectRoom();
    const suit = await addInventoryObject(RING_MAIL);
    await wearHeroArmor(suit);
    const trap = addTrap(level, RUST_TRAP, 10, 10);
    pushKeys(' '.repeat(20));
    initRng(2n);

    await triggerHeroTrap(trap);

    assert.match(game._pending_message, /Your mail rusts!/);
    assert.equal(suit.oeroded, 1);
});
