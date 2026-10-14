import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a fatal Oracle passive displays its damage and identifies the invisible unique killer', async () => {
    freshObjectRoom({
        flags: { verbose: true, showdamage: true, bones: false, tombstone: false, disclose: '-i -a -v -c -o' },
        hero: { uhitinc: 100, uhp: 1, uhpmax: 40, urexp: 100, seeInvisible: true },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const oracle = await createMonsterAt('Oracle', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    oracle.mhp = oracle.mhpmax = 2000;
    oracle.mpeaceful = false;
    oracle.msleeping = 0;
    oracle.minvis = 1;
    const messages: string[] = [];
    const input = resetInputState();
    installPagerInput(input, { expected: /Oracle|magic missiles|HP |You die|Goodbye|points|survived|turns/, limit: 12 });
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
    assert.match(messages.join('\n'), /\[HP -\d+, -\d+ left\]/);
    assert.equal(loadScoreRecords()[0]?.death, 'killed by the invisible Oracle');
});
