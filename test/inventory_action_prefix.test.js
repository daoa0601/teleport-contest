import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION, POT_HEALING, SACK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { startLuaCore } from './support/lua-game.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const { type, key, verb } of [
    { type: FOOD_RATION, key: 'e', verb: 'eating' },
    { type: POT_HEALING, key: 'q', verb: 'drinking' },
    { type: SACK, key: 'T', verb: 'tipping' },
]) {
    void test(`rejecting reqmenu prevents inventory ${verb}`, async (t) => {
        freshObjectRoom();
        const item = await addInventoryObject(type, { cknown: false });
        const input = resetInputState();
        const core = await startLuaCore(t);
        core.execute(`
            function reject_menu_request(command)
                if command == "reqmenu" then
                    nh.pline("Keep your possessions as they are.")
                    return false
                end
                return true
            end
            nh.callback("cmd_before", "reject_menu_request")
        `);
        planInput(input, t, [
            { prompt: /\(end\)/, keys: item.invlet },
            { prompt: /Do what with/, keys: key },
        ]);
        await rhack('i'.charCodeAt(0));
        await rhack(0);
        assert.equal(game._pending_message, 'Keep your possessions as they are.');
        assert.equal(game.inventory.includes(item), true);
        assert.equal(item.cknown, false);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=inventory_action_prefix.test.js.map