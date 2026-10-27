import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWandEffect } from '../js/wand_effects.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { APPLE, WAN_PROBING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
// C invent.c:display_minventory() shows a probed monster's whole inventory
// as a menu titled s_suffix(noit_Monnam(mon)) — pets read "Your kitten" —
// and query_objlist()'s INVORDER_SORT groups the entries by object class in
// inv_order under class headings while the tty layer generates the selector
// letters (pickup.c:1102-1143).
void test('probing a pet lists its possessions under class headings', async () => {
    const input = freshTurnRoom();
    const kitten = await createMonsterAt('kitten', 12, 10);
    kitten.mtame = 1;
    kitten.mpeaceful = true;
    kitten.minvent = [
        await knownObject(APPLE, { initialize: false }),
        await knownObject(WAN_PROBING, { initialize: false, spe: 3 }),
    ];
    const wand = await knownObject(WAN_PROBING, { initialize: false, spe: 3, where: 'inventory' });
    game.u.dx = 1;
    game.u.dy = 0;
    game.u.dz = 0;
    const screens = [];
    input.display = {
        async readKey() {
            screens.push(requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n'));
            return ' '.charCodeAt(0);
        },
    };
    await applyWandEffect(wand);
    const menu = screens.find(screen => /possessions:/.test(screen));
    assert.ok(menu, `no possessions menu in ${JSON.stringify(screens)}`);
    assert.match(menu, /a - an (?:uncursed )?apple/);
    assert.match(menu, /b - a (?:uncursed )?wand/);
    assert.match(menu, /Your kitten's possessions:/);
    assert.match(menu, /Comestibles/);
    assert.match(menu, /Wands/);
});
//# sourceMappingURL=probe_pet_possessions_menu.test.js.map