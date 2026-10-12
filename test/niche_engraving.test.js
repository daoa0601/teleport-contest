import test from 'node:test';
import assert from 'node:assert/strict';
import { DUST } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { plineWithContinuation } from '../js/display.js';
import { readEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a niche warning with an eroded question mark still ends its reading with a period', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await init_dungeons();
    game.u.uz = { dnum: 0, dlevel: 18 };
    for (let seed = 1; seed <= 60; seed++) {
        initRng(BigInt(seed));
        await mklev();
        const warning = game.level.engravings?.find(engraving => engraving.engr_type === DUST && engraving.text.endsWith('?'));
        if (!warning)
            continue;
        installPagerInput(resetInputState(), { expected: /written here/, limit: 2 });
        await readEngravingAt(warning.x, warning.y, {
            showMore: plineWithContinuation,
            showLine: plineWithContinuation,
        });
        assert.ok(game._pending_message.endsWith('".'), game._pending_message);
        return;
    }
    assert.fail('No aged niche warning ended in a question mark in 60 generated levels');
});
//# sourceMappingURL=niche_engraving.test.js.map