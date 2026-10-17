import assert from 'node:assert/strict';
import test from 'node:test';
// C o_init.c shuffles wand materials with their descriptions, and
// dothrow.c:breaktest() breaks any non-artifact GLASS object; breakmsg()
// sends a breaking wand "into a thousand pieces".
import { game } from '../js/gstate.js';
import { breakFloorObject } from '../js/object_breakage.js';
import { WAN_STRIKING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const GLASS = 19;
const IRON = 11;
for (const [material, label] of [[GLASS, 'glass'], [IRON, 'iron']]) {
    void test(`a wand whose shuffled appearance is ${label} ${material === GLASS ? 'shatters' : 'survives'} an impact`, async () => {
        freshObjectRoom();
        game.objectMaterials ??= [];
        game.objectMaterials[WAN_STRIKING] = material;
        const wand = await floorObject(WAN_STRIKING, 11, 10);
        const messages = [];
        const result = await breakFloorObject(wand, {
            random: () => 99,
            publish: async (message) => { messages.push(message); return null; },
        });
        assert.equal(result.destroyed, material === GLASS);
        if (material === GLASS)
            assert.match(messages.join(' '), /shatters into a thousand pieces!$/u);
        else
            assert.equal(wand.where, 'floor');
    });
}
//# sourceMappingURL=wand_shuffled_breakage.test.js.map