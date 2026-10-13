import assert from 'node:assert/strict';
import test from 'node:test';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { LONG_SWORD, SPEAR } from '../js/object_data.js';
import { polymonHero } from '../js/polyself.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
for (const [type, noun] of [[SPEAR, 'spear'], [LONG_SWORD, 'sword']]) {
    void test(`losing hands makes the hero drop the ${noun} by its weapon description`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const weapon = await addInventoryObject(type);
        await setPrimaryWeapon(weapon);
        const input = resetInputState();
        installPagerInput(input, { expected: /newt|drop|command|swim/, limit: 12 });
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        await polymonHero(MONSTER_NAME.indexOf('newt'));
        await flushPendingTopline();
        assert.match(messages.join('\n'), new RegExp(`You find you must drop your ${noun}!`));
        assert.equal(game.inventory.includes(weapon), false);
        assert.equal(game.level.objects[game.u.ux]?.[game.u.uy]?.includes(weapon), true);
    });
}
//# sourceMappingURL=pool_drop_weapon.test.js.map