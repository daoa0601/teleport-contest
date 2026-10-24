import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { finishScheduledLevelChange, gotoLevel } from '../js/level_change.js';
import { levelTeleport } from '../js/level_teleport.js';
import { resetInputState } from '../js/input.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { createDungeon } from './support/topology.js';
import { answerPrompts } from './support/input-boundaries.js';
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
    const seen = [];
    const input = resetInputState();
    input.beforeRead = () => {
        seen.push(game._pending_message || game._retained_message || '');
        input.feed(' ');
    };
    await gotoLevel({ dnum: 0, dlevel: 2 });
    await gotoLevel({ dnum: 0, dlevel: 1 });
    const firstArrival = [...seen, game._pending_message || ''].join('\n');
    assert.match(firstArrival, /telepathic message from the Norn/, 'first arrival at the entrance should deliver the leader summons');
    await gotoLevel({ dnum: 0, dlevel: 2 });
    await gotoLevel({ dnum: 0, dlevel: 1 });
    const revisit = [...seen, game._pending_message || ''].join('\n');
    assert.match(revisit, /You again sense the Norn pleading for help\./, 'a revisit to the cached entrance level should deliver the reminder');
});
// C do.c:goto_level() delivers the summons only when the previous level
// was outside the Quest (In_quest(&u.uz0), do.c:1918).  The wizard
// forced-destination level teleport can leave the Quest without the
// portal (teleport.c force_dest skips the quest clamp), and that arrival
// stays silent.
void test('a wizard forced teleport out of the quest does not repeat the leader summons', async () => {
    freshConnectedLevels({ role: 'valkyrie' });
    const cache = game._levelCache;
    const destination = cache?.get('0:2');
    assert.ok(cache && destination);
    game.dungeons.push(createDungeon({ dname: 'The Quest' }));
    game.quest_dnum = 1;
    game.branches = [{
            end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 1, dlevel: 1 },
            type: 'portal', portal: true, end1_up: false,
        }];
    // The hero waits on the quest home level; the leader has called once.
    cache.set('1:1', destination);
    game.level = destination.level;
    game.u.uz = { dnum: 1, dlevel: 1 };
    game.flags.debug = true;
    (game.u.uevent ??= {}).qcalled = 1;
    const input = resetInputState();
    await answerPrompts((async () => {
        await levelTeleport({ menuRequested: true });
        await finishScheduledLevelChange();
    })(), input, [
        { prompt: /Level teleport to where:/, keys: 'a' },
    ]);
    assert.deepEqual(game.u.uz, { dnum: 0, dlevel: 1 });
    // The materialization line stays pending; no summons follows it.
    assert.equal(game._pending_message, 'You materialize on a different level!');
    assert.doesNotMatch(game._pending_message ?? '', /pleading for help|telepathic message/, 'an arrival from inside the quest delivers no summons (In_quest(&u.uz0))');
});
//# sourceMappingURL=quest_portal_summons.test.js.map