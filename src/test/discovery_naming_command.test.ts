import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { recordObjectCall, recordObjectKnowledge } from '../js/object_knowledge.js';
import { renameDiscoveredType } from '../js/o_init.js';
import { ATR_BOLD, ATR_INVERSE, CLR_RED, NO_COLOR  } from '../js/terminal.js';
import { C_ATR_BOLD } from '../js/color_attr.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('discovery naming can replace a previously assigned type name', async t => {
    freshObjectRoom();
    await addInventoryObject(RIN_PROTECTION, { typeKnown: false });
    recordObjectCall(RIN_PROTECTION, 'Defense');
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('d');
    planInput(input, t, [
        { prompt: /Pick an object type to name/, keys: 'a' },
        { prompt: /Call a ring called Defense:/, keys: 'Ward\r' },
    ]);

    await rhack('#'.charCodeAt(0));

    assert.equal(game._objectCallNames?.[RIN_PROTECTION], 'Ward');
});

for (const { outcome, blindTurns, discovery } of [
    { outcome: 'marks a sighted discovery as encountered', blindTurns: 0,
        discovery: /\n  ring of protection \([a-z ]+\) *\n/ },
    { outcome: 'keeps a blind discovery unencountered', blindTurns: 10,
        discovery: /\n\* ring of protection \([a-z ]+\) *\n/ },
]) {
    void test(`cancelling a rename ${outcome}`, async t => {
        freshObjectRoom({ hero: { blindTurns } });
        recordObjectKnowledge(RIN_PROTECTION);
        const input = resetInputState();
        input.feed('name\r');
        queueCommandKeys('d');
        planInput(input, t, [
            { prompt: /Pick an object type to name/, keys: 'a' },
            { prompt: /Call a ring of protection:/, keys: '\x1b' },
            { prompt: discovery, keys: ' ' },
        ]);

        await rhack('#'.charCodeAt(0));
        assert.equal(game._objectCallNames?.[RIN_PROTECTION], undefined);
        await rhack('\\'.charCodeAt(0));
        assert.equal(game.context.move, 0);
    });
}

for (const { style, configured, gameover } of [
    { style: 'default', configured: false, gameover: false },
    { style: 'configured', configured: true, gameover: false },
    { style: 'suppressed after game over', configured: true, gameover: true },
]) {
    void test(`discovery naming class headings use ${style} highlighting`, async () => {
        freshObjectRoom();
        await addInventoryObject(RIN_PROTECTION, { typeKnown: false });
        recordObjectCall(RIN_PROTECTION, 'Defense');
        if (configured) game.iflags.menu_headings = { attr: C_ATR_BOLD, color: CLR_RED };
        game.program_state.gameover = gameover;
        const input = resetInputState();
        const operation = renameDiscoveredType();
        await input.waitUntilBlocked();
        try {
            const row = requireGameDisplay().grid.find(cells => cells.map(cell => cell.ch).join('').includes('Rings'));
            assert.ok(row, 'The discovery naming menu shows the Rings class heading');
            const column = row.map(cell => cell.ch).join('').indexOf('Rings');
            for (const cell of row.slice(column, column + 'Rings'.length)) {
                assert.equal(cell.attr, gameover ? 0 : configured ? ATR_BOLD : ATR_INVERSE, 'The heading uses the configured attribute');
                assert.equal(cell.color, configured && !gameover ? CLR_RED : NO_COLOR, 'The heading uses the configured color');
            }
        } finally {
            input.feed('\x1b');
            await operation;
        }
        assert.equal(game.context.move, 0);
    });
}

