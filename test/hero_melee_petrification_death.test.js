import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('barehand contact petrification identifies the real invisible named creature', async () => {
    freshObjectRoom({
        flags: { verbose: true, bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 40, uhpmax: 40, urexp: 100, seeInvisible: true },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const bird = await createMonsterAt('cockatrice', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    setMonsterGivenName(bird, 'Birdie');
    bird.mhp = bird.mhpmax = 2000;
    bird.mpeaceful = false;
    bird.msleeping = 0;
    bird.minvis = 1;
    const messages = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /Birdie|cockatrice|stone|Goodbye|points|survived|turns/, limit: 12 });
    const pager = input.display;
    assert.ok(pager);
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return pager.readKey();
        },
    };
    pushKey('l');
    initRng(41n);
    await rhack('F'.charCodeAt(0));
    messages.push(game._pending_message);
    assert.equal(game.program_state.gameover, true);
    assert.match(messages.join('\n'), /You turn to stone/);
    assert.doesNotMatch(messages.join('\n'), /You die/);
    assert.equal(loadScoreRecords()[0]?.death, 'petrified by an invisible cockatrice called Birdie');
});
//# sourceMappingURL=hero_melee_petrification_death.test.js.map