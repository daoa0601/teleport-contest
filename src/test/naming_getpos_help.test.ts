import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

for (const target of ['monster', 'floor object']) {
    for (const { binding, key, label, instructions } of [
        { binding: '!', key: '!', label: '!', instructions: /For instructions type a '!'/ },
        { binding: 'C-a', key: '\x01', label: '^A', instructions: /For instructions type a '\^A'/ },
    ]) {
        void test(`${target} naming advertises and accepts the rebound ${label} help key`, async t => {
            freshObjectRoom({ flags: { tips: false, verbose: true } });
            applyNethackrc(`BINDINGS=${binding}:getpos.help`);
            const soldier = target === 'monster'
                ? await createMonsterAt('soldier', 11, 10, NO_MINVENT) : null;
            if (!soldier) await floorObject(RIN_PROTECTION, 10, 10, { typeKnown: false });
            const input = resetInputState();
            input.feed('name\r');
            queueCommandKeys(soldier ? '#m' : '#f');
            planInput(input, t, [
                { prompt: instructions, keys: key },
                { prompt: /Use 'h', 'j', 'k', 'l' to move the cursor/, keys: ' ' },
                { prompt: /Move cursor to/, keys: soldier ? 'l.' : '.' },
                { prompt: soldier ? /What do you want to call the soldier\?/ : /Call an? .*ring:/,
                    keys: 'Watcher\r' },
            ]);

            await rhack('#'.charCodeAt(0));

            assert.equal(soldier ? soldier.mgivenname : game._objectCallNames?.[RIN_PROTECTION], 'Watcher');
            assert.equal(game.context.move, 0);
        });
    }
}
