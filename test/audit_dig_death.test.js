import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
void test('a fatal self-directed pick strike records the native possessive death cause', async () => {
    freshObjectRoom({
        hero: { uhp: 1, uhpmax: 40, urexp: 100 },
        flags: { verbose: true, female: false, bones: false, tombstone: false,
            disclose: '-i -a -v -c -o' },
    });
    game.storage = memoryStorage();
    game.plname = 'Victim';
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    const pick = await addInventoryObject(PICK_AXE, { spe: 0, owornmask: W_WEP });
    game.uwep = game.u.uwep = pick;
    const input = resetInputState();
    installPagerInput(input, { expected: /pick|hit yourself|die|points|Goodbye/i, limit: 10 });
    input.feed(`${pick.invlet}.`);
    await rhack('a'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by his own pick-axe');
});
//# sourceMappingURL=audit_dig_death.test.js.map