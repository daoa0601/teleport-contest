import assert from 'node:assert/strict';
import test from 'node:test';
import { buryFloorObjectsAt } from '../js/buried_object.js';
import { placeObject } from '../js/floor_object.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { probeObject } from '../js/magic_probe.js';
import { addObjectToContainer } from '../js/object_container.js';
import { DIAMOND, SACK, WAN_PROBING } from '../js/object_data.js';
import { applyWandEffect } from '../js/zap.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
for (const location of ['container', 'buried']) {
    void test(`probing one ${location} object lists its class and an item letter`, async () => {
        const input = freshTurnRoom();
        const diamond = await knownObject(DIAMOND, { initialize: false });
        const screens = [];
        input.display = {
            async readKey() {
                screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'));
                return ' '.charCodeAt(0);
            },
        };
        if (location === 'container') {
            const sack = await addInventoryObject(SACK);
            await addObjectToContainer(sack, diamond);
            await probeObject(sack);
        }
        else {
            await placeObject(diamond, game.u.ux, game.u.uy);
            await buryFloorObjectsAt(game.u.ux, game.u.uy);
            const wand = await addInventoryObject(WAN_PROBING, { spe: 3 });
            game.u.dx = game.u.dy = 0;
            game.u.dz = 1;
            await applyWandEffect(wand);
        }
        const menu = screens.find(screen => /Contents of|Things that are buried/.test(screen));
        assert.ok(menu, `${location}: the probe must display the object list`);
        assert.match(menu, /Gems\/Stones/, `${location}: class heading missing\n${menu}`);
        assert.match(menu, /a - an? (?:uncursed )?diamond/, `${location}: item letter missing\n${menu}`);
        assert.equal(diamond.dknown, true, 'probing observes the item');
    });
}
//# sourceMappingURL=probe_object_inventory_menu.test.js.map