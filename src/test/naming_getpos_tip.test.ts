import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { startLuaCore } from './support/lua-game.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('first map naming keeps the verbose instruction pager after the tip', async t => {
    for (const target of ['monster', 'floor object']) {
        await t.test(target, async t => {
            freshObjectRoom({ flags: { tips: true, verbose: true } });
            await startLuaCore(t);
            const soldier = target === 'monster'
                ? await createMonsterAt('soldier', 11, 10, NO_MINVENT) : null;
            if (!soldier) await floorObject(RIN_PROTECTION, 10, 10, { typeKnown: false });
            const input = resetInputState();
            input.feed('name\r');
            queueCommandKeys(soldier ? 'm' : 'f');
            planInput(input, t, [
                { prompt: /Tip: Farlooking or selecting a map location/, keys: ' ' },
                { prompt: /For instructions[\s\S]*--More--/, keys: ' ' },
                { prompt: /Move cursor to/, keys: soldier ? 'l.' : '.' },
                { prompt: soldier ? /What do you want to call the soldier\?/ : /Call an? .*ring:/,
                    keys: 'Watcher\r' },
            ]);

            await rhack('#'.charCodeAt(0));

            assert.equal(soldier ? soldier.mgivenname : game._objectCallNames?.[RIN_PROTECTION], 'Watcher');
            assert.equal(game.context.move, 0);
        });
    }
});
