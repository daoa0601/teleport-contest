import assert from 'node:assert/strict';
import test from 'node:test';
import { buryFloorObjectsAt } from '../js/dig.js';
import { addBuriedObject, placeObject } from '../js/mkobj.js';
import { CORPSTAT_FEMALE, CORPSTAT_MALE, POOL } from '../js/const.js';
import { game, requireGameDisplay, requireGameLevel } from '../js/gstate.js';
import { probeObject } from '../js/zap.js';
import { addObjectToContainer } from '../js/mkobj.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, DIAMOND, SACK, WAN_PROBING } from '../js/object_data.js';
import { applyWandEffect } from '../js/zap.js';
import { grantIntrinsicProperty } from '../js/properties.js';
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
for (const location of ['buried', 'underwater']) {
    for (const remoteGender of [CORPSTAT_MALE, CORPSTAT_FEMALE]) {
        void test(`${location} probing checks corpse gender across squares without revealing remote items (${remoteGender})`, async () => {
            const input = freshTurnRoom();
            const local = await knownObject(CORPSE, {
                initialize: false, corpsenm: MONSTER_NAME.indexOf('newt'),
                spe: CORPSTAT_MALE, invlet: 'a', dknown: false,
            });
            const remote = await knownObject(CORPSE, {
                initialize: false, corpsenm: MONSTER_NAME.indexOf('newt'),
                spe: remoteGender, invlet: 'b', dknown: false,
            });
            if (location === 'buried') {
                addBuriedObject(local, game.u.ux, game.u.uy);
                addBuriedObject(remote, game.u.ux + 1, game.u.uy);
            }
            else {
                // Native nobj from the probed pile includes older floor objects.
                await placeObject(remote, game.u.ux + 1, game.u.uy);
                await placeObject(local, game.u.ux, game.u.uy);
                await placeObject(await knownObject(DIAMOND, { initialize: false }), game.u.ux, game.u.uy);
                requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = POOL;
                grantIntrinsicProperty('levitation', 'outside');
            }
            const wand = await addInventoryObject(WAN_PROBING, { spe: 3 });
            game.u.dx = game.u.dy = 0;
            game.u.dz = 1;
            const title = location === 'buried' ? 'Things that are buried here:' : 'Things that are under the water here:';
            let menu = '';
            input.display = {
                async readKey() {
                    const view = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
                    if (view.includes(title))
                        menu = view;
                    return ' '.charCodeAt(0);
                },
            };
            await applyWandEffect(wand);
            assert.ok(menu.includes(title), `Missing probed inventory menu: ${title}`);
            if (remoteGender === CORPSTAT_FEMALE)
                assert.match(menu, /male newt corpse/);
            else
                assert.doesNotMatch(menu, /male newt corpse/);
            assert.equal(menu.match(/newt corpse/g)?.length, 1, 'only the corpse at the probed square is listed');
            assert.equal(local.dknown, true);
            assert.equal(remote.dknown, false, 'probing must not observe the remote corpse');
        });
    }
}
//# sourceMappingURL=probe_object_inventory_menu.test.js.map