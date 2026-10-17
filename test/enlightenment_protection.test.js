import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { showEnlightenment } from '../js/insight.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { requirePlayingGame } from '../js/gstate.js';
void test('enlightenment reports worn magic protection once, among resistances', async () => {
    freshGameplayRoom({ role: 'wizard', flags: { debug: true } });
    await wearHeroArmor(await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE));
    const input = resetInputState();
    const report = showEnlightenment({ basic: false, magic: true });
    let protectionLines = 0;
    try {
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            const text = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            protectionLines += (text.match(/You are magic-protected/g) ?? []).length;
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    assert.equal(protectionLines, 1);
    assert.equal(game.u.antimagic, true);
});
void test('attributes predicts a safe #pray from the live prayer rules', async () => {
    freshObjectRoom({
        flags: { debug: true },
        hero: { ublesscnt: 0, ugangr: 0, uluck: 0, ualign: { type: 0, record: 10 } },
    });
    requirePlayingGame(game);
    const input = resetInputState();
    const report = runExtendedCommand('attributes');
    let text = '';
    let pages = 0;
    try {
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            assert.ok(++pages <= 8, 'the attributes report did not finish');
            text += requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    const prayerLine = text.split('\n').find(line => line.includes('safely pray'));
    assert.equal(prayerLine?.trim(), 'You can safely pray (0).');
    resetInputState();
    await runExtendedCommand('pray', 'y n\x1b');
    assert.equal(game.u.invulnerable, true);
});
// tty numbers enlightenment pages only when the report needs more than one.
void test('a one-page enlightenment report ends with (end), a longer one numbers its pages', async () => {
    for (const magic of [false, true]) {
        freshGameplayRoom({ role: 'valkyrie', flags: { debug: magic } });
        const input = resetInputState();
        const report = showEnlightenment({ basic: magic, magic });
        const footers = [];
        try {
            for (;;) {
                const blocked = await Promise.race([
                    input.waitUntilBlocked().then(() => true), report.then(() => false),
                ]);
                if (!blocked)
                    break;
                const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trimEnd());
                footers.push(rows.filter(row => /^ \((end|\d+ of \d+)\)$/.test(row)).join());
                input.feed(' ');
            }
        }
        finally {
            input.feed('\x1b');
            await report;
        }
        if (!magic)
            assert.deepEqual(footers, [' (end)']);
        else {
            assert.ok(footers.length > 1);
            assert.deepEqual(footers, footers.map((_, page) => ` (${page + 1} of ${footers.length})`));
        }
    }
});
//# sourceMappingURL=enlightenment_protection.test.js.map