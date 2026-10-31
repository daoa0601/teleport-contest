import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { LAVAPOOL, TT_LAVA } from '../js/const.js';
import { flush_screen, moreUntilDismissed } from '../js/display.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { sinkHeroIntoLava } from '../js/hack.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';
// C trap.c:sink_into_lava() calls done(DISSOLVED) with positive HP.
// end.c:done() redraws status before zeroing HP and asking "Die?".
void test('sinking during a rush while trapped in lava refreshes time before the death pager', async () => {
    const input = freshTurnRoom({
        flags: { time: true, debug: true, bones: false },
        hero: { fireResistance: true, utrap: (3 << 8) + 4, utraptype: TT_LAVA },
    });
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    await flush_screen(1);
    const start = game.moves;
    const hp = game.u.uhp;
    let fatalPages = 0;
    let questions = 0;
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads <= 10, 'the lava death must finish its recovery prompts');
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            const status = requireScreenRow(23).map(cell => cell.ch).join('');
            if (message.includes('--More--')) {
                if (message.includes('You sink below the surface and die.')) {
                    fatalPages++;
                    assert.equal(game.moves, start + 3, 'the rush spent three trapped actions');
                    assert.equal(status.match(/\bT:(\d+)\b/)?.[1], String(game.moves), 'done() refreshes the turn counter even between runmode redraws');
                    assert.match(status, new RegExp(`HP:${hp}\\(${hp}\\)`), 'the death pager retains the pre-death hit points');
                    assert.match(status, /InLava/);
                }
                return 32;
            }
            if (message.startsWith('Die?')) {
                questions++;
                assert.match(status, new RegExp(`T:${game.moves}\\b`));
                assert.match(status, /HP:0\(/, 'done() zeroes HP before the refusal question');
                return 'n'.charCodeAt(0);
            }
            return 27;
        },
    };
    input.feed('Gy');
    for (let action = 0; action < 4; action++)
        await moveloop_core();
    assert.equal(fatalPages, 1, 'the sinking death must reach its message pager');
    assert.equal(questions, 1, 'the wizard can decline the sinking death');
    assert.equal(game.u.utrap, 0, 'survival frees the hero from the lava');
});
void test('a sinking death is announced after Escape suppresses ordinary messages', async () => {
    const input = freshTurnRoom({
        flags: { debug: true, bones: false },
        hero: { fireResistance: true, utrap: 1 << 8, utraptype: TT_LAVA },
    });
    requireGameLevel().requireAt(game.u.ux, game.u.uy).typ = LAVAPOOL;
    input.feed('\x1b');
    await moreUntilDismissed('You hear a distant rumbling.');
    let fatalPages = 0;
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads <= 10, 'the lava death must finish its recovery prompts');
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            if (message.includes('--More--')) {
                if (message.includes('You sink below the surface and die.'))
                    fatalPages++;
                return 32;
            }
            assert.match(message, /^Die\?/);
            return 'n'.charCodeAt(0);
        },
    };
    const result = await sinkHeroIntoLava();
    assert.equal(fatalPages, 1, 'urgent_pline() overrides Escape suppression for the sinking death');
    assert.equal(result?.died, false, 'the wizard can decline the announced death');
});
//# sourceMappingURL=lava_sinking_status.test.js.map