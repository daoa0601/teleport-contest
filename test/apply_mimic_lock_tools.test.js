import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DOOR, D_NODOOR, M_AP_FURNITURE, M_AP_TYPE, MM_ANGRY, NO_MINVENT, W_WEP } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { CmapSymbol } from '../js/glyph_numbers.js';
import { pushKeys } from '../js/input.js';
import { CREDIT_CARD, LOCK_PICK, SKELETON_KEY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const toolType of [CREDIT_CARD, LOCK_PICK, SKELETON_KEY]) {
    for (const detected of [false, true]) {
        void test(`a ${detected ? 'detected' : 'hidden'} door mimic can absorb a wielded lock tool (${toolType})`, async () => {
            const level = freshObjectRoom({ hero: { detectMonsters: detected } });
            const doorway = level.requireAt(11, 10);
            doorway.typ = DOOR;
            doorway.doormask = D_NODOOR;
            const mimic = await createMonsterAt('small mimic', 11, 10, MM_ANGRY | NO_MINVENT);
            mimic.m_ap_type = M_AP_FURNITURE;
            mimic.mappearance = CmapSymbol.vcdoor;
            mimic.msleeping = 1;
            const tool = await addInventoryObject(toolType, {
                invlet: 'a', wielded: true, owornmask: W_WEP,
            });
            game.uwep = game.u.uwep = tool;
            newsym(11, 10);
            initRng(46n);
            pushKeys('al' + ' '.repeat(5));
            await rhack('a'.charCodeAt(0));
            assert.equal(M_AP_TYPE(mimic), 0);
            assert.equal(mimic.msleeping, 0);
            assert.equal(game.inventory.includes(tool), false);
            assert.equal(game.uwep, null);
            assert.equal(tool.owornmask, 0);
            assert.equal(tool.where, 'minvent');
            assert.equal(tool.ocarry, mimic);
            assert.ok(mimic.minvent?.includes(tool));
            assert.match(game._pending_message, /pulls your .* away from you and absorbs it!/);
            assert.equal(game.context.move, 1);
        });
    }
}
//# sourceMappingURL=apply_mimic_lock_tools.test.js.map