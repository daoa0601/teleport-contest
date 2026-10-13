import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, POOL, TT_LAVA } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { heroLiquidEffects, sinkHeroIntoLava } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a wizard who declines lava death recovers and teleports to safety', async () => {
    const level = freshObjectRoom({ flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    const input = resetInputState();
    const burning = heroLiquidEffects();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Die\? \[yn\]/);
        input.feed('n');
        const result = await burning;
        assert.ok(result?.entered);
        assert.equal(result.died, false);
        assert.equal(!!game.program_state.gameover, false);
        assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL);
        assert.ok((game.u.uhp ?? 0) > 0);
    } finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});

function refuseLiquidDeaths() {
    const input = resetInputState();
    let refusals = 0;
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('--More--')) return ' '.charCodeAt(0);
            assert.match(text, /Die\? \[yn\]/, 'Liquid recovery must ask whether to die');
            assert.ok(++refusals <= 2, 'Liquid recovery must stop after two death refusals');
            return 'n'.charCodeAt(0);
        },
    };
    return () => refusals;
}

for (const mode of ['debug', 'explore'] as const) {
    for (const cause of ['sinking', 'drowning'] as const) {
        void test(`${mode} death refusal rescues a ${cause} hero to dry ground`, async () => {
            const level = freshObjectRoom({ flags: { [mode]: true, bones: false } });
            const { ux, uy } = game.u;
            for (let x = ux - 1; x <= ux + 1; x++) {
                for (let y = uy - 1; y <= uy + 1; y++)
                    level.requireAt(x, y).typ = cause === 'sinking' ? LAVAPOOL : POOL;
            }
            if (cause === 'sinking') {
                game.u.fireResistance = true;
                game.u.utrap = 1 << 8;
                game.u.utraptype = TT_LAVA;
            }
            const refusals = refuseLiquidDeaths();

            const result = cause === 'sinking'
                ? await sinkHeroIntoLava() : await heroLiquidEffects();

            assert.equal(result?.died, false, 'Declining death must report survival');
            assert.equal(!!game.program_state.gameover, false);
            assert.equal(refusals(), 1);
            assert.ok((game.u.uhp ?? 0) > 0);
            assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ,
                cause === 'sinking' ? LAVAPOOL : POOL, 'Recovery must leave the fatal liquid');
            assert.equal(game.u.utrap ?? 0, 0);
            assert.equal(game.u.uinwater ?? 0, 0);
            if (cause === 'drowning')
                assert.match(game._pending_message ?? '', /You find yourself on solid ground\./);
        });
    }
}

void test('two drowning refusals survive even when the level has no dry landing', async () => {
    const level = freshObjectRoom({ flags: { explore: true, bones: false } });
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) level.requireAt(x, y).typ = POOL;
    }
    const refusals = refuseLiquidDeaths();

    const result = await heroLiquidEffects();

    assert.equal(result?.died, false);
    assert.equal(refusals(), 2);
    assert.equal(!!game.program_state.gameover, false);
    assert.ok((game.u.uhp ?? 0) > 0);
    assert.equal(game.u.uinwater, 0);
    assert.match(game._pending_message ?? '', /You find yourself on top of water\./);
});
