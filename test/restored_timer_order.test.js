import assert from 'node:assert/strict';
import test from 'node:test';
import { flushPendingTopline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { gotoLevel } from '../js/level_change.js';
import { beginObjectBurn } from '../js/light.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { BRASS_LANTERN, OIL_LAMP } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { runDueTimers } from '../js/timer_effects.js';
import { vision_recalc } from '../js/vision.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
function bonesRoom(storage) {
    freshObjectRoom({ flags: { debug: true } });
    game.storage = storage;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
}
for (const owner of ['inventory', 'floor', 'mixed', 'cached', 'bones']) {
    void test(`restored ${owner} timers announce equal-time fuel warnings in native restore order`, async () => {
        const storage = memoryStorage();
        if (owner === 'cached')
            freshConnectedLevels();
        else if (owner === 'bones')
            bonesRoom(storage);
        else
            freshObjectRoom();
        requirePlayingGame(game);
        game.flags.verbose = false;
        const lamp = owner === 'inventory'
            ? await addInventoryObject(OIL_LAMP, { age: 160 })
            : await floorObject(OIL_LAMP, 15, 10, { age: 160 });
        const lantern = owner === 'inventory' || owner === 'mixed'
            ? await addInventoryObject(BRASS_LANTERN, { age: 160 })
            : await floorObject(BRASS_LANTERN, 15, 10, { age: 160 });
        beginObjectBurn(lamp);
        beginObjectBurn(lantern);
        const expiry = game.moves + 10;
        if (owner === 'cached') {
            await gotoLevel({ dlevel: 2 }, { arrival: 'stairs' });
            game.moves++;
            await gotoLevel({ dlevel: 1 }, { arrival: 'stairs' });
        }
        else if (owner === 'bones') {
            assert.equal(saveBonesLevel(), true);
            bonesRoom(storage);
            resetInputState().feed('yn');
            await mklev();
            assert.equal(game._restoredBones, true);
        }
        else {
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
        }
        vision_recalc(0);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /lamp|lantern/, limit: 4 });
        game.moves = expiry;
        await runDueTimers();
        await flushPendingTopline();
        const text = messages.join('\n');
        const lampWarning = text.indexOf('lamp flicker');
        const lanternWarning = text.indexOf('lantern');
        assert.ok(lampWarning >= 0 && lanternWarning > lampWarning, `The restored lamp must warn before the lantern: ${text}`);
    });
}
//# sourceMappingURL=restored_timer_order.test.js.map