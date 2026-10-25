import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { showEnlightenment } from '../js/insight.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE, LONG_SWORD, SHORT_SWORD } from '../js/object_data.js';
import { P_BASIC, P_LONG_SWORD, P_SHORT_SWORD, P_TWO_WEAPON_COMBAT, P_UNSKILLED, TERMINAL_COLS } from '../js/const.js';
import { ensureHeroSkills } from '../js/skills.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
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
// C tty_end_menu() cuts an entry to cols - 2 characters, so the ^X menu never
// draws its final column even when an enlightenment line would reach it.
void test('enlightenment clips a full-width two-weapon skill line like the tty menu', async () => {
    freshObjectRoom({ role: 'samurai', flags: { debug: true } });
    requirePlayingGame(game);
    const skills = ensureHeroSkills(game);
    assert.ok(skills);
    for (const skill of [P_LONG_SWORD, P_SHORT_SWORD]) {
        const entry = skills[skill];
        assert.ok(entry);
        entry.skill = P_BASIC;
    }
    const twoWeapon = skills[P_TWO_WEAPON_COMBAT];
    assert.ok(twoWeapon);
    twoWeapon.skill = P_UNSKILLED;
    await setPrimaryWeapon(await addInventoryWeapon(LONG_SWORD));
    await setSecondaryWeapon(await addInventoryWeapon(SHORT_SWORD));
    game.u.twoweap = true;
    const input = resetInputState();
    const report = showEnlightenment({ basic: false, magic: true });
    let row = '';
    let lastColumn = '';
    try {
        for (;;) {
            const blocked = await Promise.race([
                input.waitUntilBlocked().then(() => true), report.then(() => false),
            ]);
            if (!blocked)
                break;
            for (const cells of requireGameDisplay().grid) {
                const text = cells.map(cell => cell.ch).join('');
                if (text.includes('short sword is also limited')) {
                    row = text;
                    lastColumn = cells[TERMINAL_COLS - 1]?.ch ?? '';
                }
            }
            input.feed(' ');
        }
    }
    finally {
        input.feed('\x1b');
        await report;
    }
    assert.equal(row.trimEnd(), '  Your skill in short sword is also limited by being unskilled with two weapons');
    assert.equal(lastColumn, ' ');
});
//# sourceMappingURL=enlightenment_protection.test.js.map