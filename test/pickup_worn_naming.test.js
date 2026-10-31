import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MENU_FULL, MENU_TRADITIONAL, MM_NOGRP, MM_NOWAIT, NO_MINVENT, W_AMUL, } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
for (const { style, label } of [
    { style: MENU_FULL, label: 'menu' },
    { style: MENU_TRADITIONAL, label: 'traditional' },
]) {
    void test(`${label} pickup names the engulfer as owner of its worn amulet`, async () => {
        freshPlayableRoom({ flags: { menu_style: style } });
        const engulfer = await createMonsterAt('Juiblex', 10, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        const amulet = await knownObject(AMULET_OF_LIFE_SAVING, {
            oname: 'Keepsake', cursed: true,
        });
        await equipMonsterObject(engulfer, amulet, W_AMUL);
        game.u.uswallow = 1;
        game.u.ustuck = engulfer;
        if (style === MENU_FULL)
            pushKeys('a\n');
        await rhack(','.charCodeAt(0));
        assert.equal(game._pending_message, "You can't pick Juiblex's amulet of life saving up.");
        assert.equal(engulfer.minvent.includes(amulet), true);
        assert.equal(game.inventory.includes(amulet), false);
        assert.equal(amulet.owornmask, W_AMUL);
    });
}
//# sourceMappingURL=pickup_worn_naming.test.js.map