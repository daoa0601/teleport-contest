import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM, STONE, W_NONDIGGABLE } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createSpecialLevel } from './support/topology.js';
void test('wizard terrain offers a readable legend for the internal terrain codes', async () => {
    freshPlayableRoom({ flags: { debug: true } });
    const input = resetInputState();
    await answerPrompts(runExtendedCommand('terrain'), input, [
        { prompt: /e - internal levl\[\]\[\]\.typ codes in base-36[\s\S]*f - legend of base-36 levl\[\]\[\]\.typ codes/, keys: 'f' },
        { prompt: /#terrain encodings:[\s\S]*0 - stone[\s\S]*\* - unreachable\/undiggable/, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
});
for (const [role, prototype] of [['wizard', 'Wiz-strt'], ['ranger', 'Ran-strt']]) {
    void test(`the terrain footer uses the ${role} quest prototype`, async () => {
        freshPlayableRoom({ role, flags: { debug: true } });
        game.specialLevels = new Map([['x-strt', createSpecialLevel({ dnum: 0, dlevel: 1 })]]);
        const input = resetInputState();
        await answerPrompts(runExtendedCommand('terrain'), input, [
            { prompt: /internal levl/, keys: 'e' },
            { prompt: new RegExp(`D:0,L:1 "${prototype}"`), keys: ' ' },
        ]);
        assert.equal(game.context.move, 0);
    });
}
void test('wizard terrain encodes real tiles and undiggable stone', async () => {
    const level = freshPlayableRoom({ flags: { debug: true } });
    level.requireAt(1, 0).typ = STONE;
    level.requireAt(1, 0).wall_info = W_NONDIGGABLE;
    level.requireAt(2, 0).typ = ROOM;
    level.requireAt(0, 0).typ = ROOM;
    const input = resetInputState();
    const action = runExtendedCommand('terrain');
    try {
        await input.waitUntilBlocked();
        input.feed('e');
        await input.waitUntilBlocked();
        const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trimEnd());
        assert.match(rows[1] ?? '', /^\*p/);
        assert.ok(rows.some(row => row.startsWith('D:0,L:1') && row.endsWith(' dungeon')));
        assert.equal(rows.at(-1), '--More--');
        assert.equal(level.requireAt(2, 0).typ, ROOM);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});
for (const explore of [false, true]) {
    void test(`${explore ? 'explore' : 'normal'} terrain hides wizard internal displays`, async () => {
        freshPlayableRoom({ flags: { explore } });
        const input = resetInputState();
        const action = runExtendedCommand('terrain');
        try {
            await input.waitUntilBlocked();
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.doesNotMatch(text, /base-36/);
            assert.equal(text.includes('full map without'), explore);
        }
        finally {
            input.feed('\x1b');
            await action;
        }
    });
}
//# sourceMappingURL=wizard_terrain_types.test.js.map