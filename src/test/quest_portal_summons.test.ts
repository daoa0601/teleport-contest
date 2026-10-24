import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { gotoLevel } from '../js/level_change.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon } from './support/topology.js';

// C do.c:goto_level() delivers the quest leader's summons on every arrival
// at the quest entrance level from outside the Quest branch; the block is
// not limited to freshly created levels.  First arrival reads
// com_pager("quest_portal"), later ones quest_portal_again (or _demand for
// Rogues).
void test('returning to a visited quest entrance repeats the leader summons', async () => {
    freshConnectedLevels({ role: 'valkyrie' });
    game.dungeons.push(createDungeon({ dname: 'The Quest' }));
    game.quest_dnum = 1;
    game.branches = [{
        end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
        type: 'portal', portal: true, end1_up: false,
    }];
    const seen: string[] = [];
    const input = resetInputState();
    input.beforeRead = () => {
        seen.push(game._pending_message || game._retained_message || '');
        input.feed(' ');
    };

    await gotoLevel({ dnum: 0, dlevel: 2 });
    await gotoLevel({ dnum: 0, dlevel: 1 });
    const firstArrival = [...seen, game._pending_message || ''].join('\n');
    assert.match(
        firstArrival, /telepathic message from the Norn/,
        'first arrival at the entrance should deliver the leader summons',
    );

    await gotoLevel({ dnum: 0, dlevel: 2 });
    await gotoLevel({ dnum: 0, dlevel: 1 });
    const revisit = [...seen, game._pending_message || ''].join('\n');
    assert.match(
        revisit, /You again sense the Norn pleading for help\./,
        'a revisit to the cached entrance level should deliver the reminder',
    );
});
