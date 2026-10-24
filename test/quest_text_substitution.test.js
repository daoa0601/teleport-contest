import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { prepareMainQuestPortalCall } from '../js/quest.js';
import { freshObjectRoom } from './support/object-room.js';
function dungeonNamed(dname) {
    return {
        dname,
        num_dunlevs: 1, entry_lev: 1, dunlev_ureached: 1, depth_start: 1,
        flags: { maze_like: false, hellish: false, alignment: null }, bonetag: undefined, protofile: undefined,
        levelFill: undefined, themeRooms: undefined,
    };
}
function valkyrieAtQuestEntrance() {
    freshObjectRoom({ role: 'valkyrie', gameplaySeed: 11n });
    game.flags.female = true;
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.u.uevent = {};
    game.dungeons = [
        dungeonNamed('The Dungeons of Doom'),
        dungeonNamed('The Quest'),
    ];
    game.branches = [{
            end1: { dnum: 0, dlevel: 1 },
            end2: { dnum: 1, dlevel: 1 },
            end1_up: true, type: 'stair', portal: false,
        }];
}
void test('the quest leader calls the hero by role leader and home names', async () => {
    valkyrieAtQuestEntrance();
    const call = await prepareMainQuestPortalCall({}, game);
    assert.deepEqual(call, [
        'You receive a faint telepathic message from the Norn:',
        'Your help is urgently needed at the Shrine of Destiny!',
        'Look for a ...ic transporter.',
        "You couldn't quite make out that last message.",
    ]);
    const reminder = await prepareMainQuestPortalCall({}, game);
    assert.deepEqual(reminder, ['You again sense the Norn pleading for help.']);
});
//# sourceMappingURL=quest_text_substitution.test.js.map