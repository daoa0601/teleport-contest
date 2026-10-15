import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, NO_MINVENT } from '../js/const.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a group leader already has its kill-alignment value when a member arrival pauses for input', async () => {
    for (let seed = 1; seed <= 16; seed++) {
        const level = freshObjectRoom({ gameplaySeed: seed, hero: { ualign: { type: 1, record: 0 } } });
        requirePlayingGame(game);
        const jackal = MONSTER_NAME.indexOf('jackal');
        game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
            born: 0, died: 0, mvflags: species === jackal ? 0 : G_GENOD,
        }));
        const input = resetInputState();
        await pline('You wait while a long message fills the top line before the monsters arrive.');

        const creating = makemonAt(null, game.u.ux, game.u.uy, NO_MINVENT);
        let group = false;
        try {
            const paused = await Promise.race([
                input.waitUntilBlocked().then(() => true),
                creating.then(() => false),
            ]);
            assert.equal(paused, true, 'the unread message must be acknowledged before the arrival');
            group = level.monsters.length > 1;
            if (group) {
                const leader = level.monsters[0];
                assert.ok(leader);
                assert.equal(leader.malign, 5, 'the hostile jackal leader is already fully initialized');
            }
        } finally {
            input.feed(' '.repeat(30));
            await creating;
        }
        if (group) return;
    }
    assert.fail('random jackal creation should sometimes produce a group');
});
