import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mapDetectedMonster } from '../js/magic_map_display.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { ATR_BOLD, ATR_INVERSE, ATR_UNDERLINE } from '../js/terminal.js';
import { ATR_BLINK } from '../js/terminal_attributes.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
const attributes = [
    { name: 'none', cell: 0, key: 'a' },
    { name: 'bold', cell: ATR_BOLD, key: 'b' },
    { name: 'dim', cell: 0, key: 'c' },
    { name: 'italic', cell: 0, key: 'd' },
    { name: 'underline', cell: ATR_UNDERLINE, key: 'e' },
    { name: 'blink', cell: ATR_BLINK, key: 'f' },
    { name: 'inverse', cell: ATR_INVERSE, key: 'g' },
];
function screenText() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function selectFullOption(name, answer) {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    let row = '', picker = '', selected = false, confirmed = false, reads = 0;
    input.beforeRead = () => {
        assert.ok(++reads < 25, `Option ${name} did not finish: ${screenText()}`);
        const screen = screenText();
        if (screen.includes('--More--')) {
            input.feed(' ');
        }
        else if (confirmed) {
            picker = screen;
            input.feed(answer);
        }
        else if (selected) {
            confirmed = true;
            input.feed('\n');
        }
        else {
            const option = screen.split('\n').find(line => line.includes(` ${name} `));
            const key = option?.match(/^\s*([a-zA-Z]) [-+] /)?.[1];
            if (key && option) {
                row = option;
                selected = true;
                input.feed(key);
            }
            else {
                assert.match(screen, /\(\d+ of \d+\)/, `Missing option ${name}`);
                input.feed(' ');
            }
        }
    };
    input.feed('O');
    try {
        await command;
        assert.ok(selected, `Option ${name} was never selected`);
        return { row, picker };
    }
    finally {
        input.beforeRead = null;
    }
}
for (const { name, cell, key } of attributes) {
    for (const projection of ['visible', 'sensed', 'detection map']) {
        void test(`${projection} pet uses configured petattr:${name}`, async () => {
            freshObjectRoom({ flags: { hilite_pet: true, use_inverse: false },
                hero: { monsterDetection: projection === 'sensed' } });
            applyNethackrc(`OPTIONS=petattr:${name}`);
            const pet = await createMonsterAt('little dog', 11, 10);
            pet.mtame = 10;
            pet.minvis = projection === 'sensed' ? 1 : 0;
            if (projection === 'detection map')
                mapDetectedMonster(pet, false);
            else
                newsym(11, 10);
            await flush_screen(1);
            assert.equal(requireScreenCell(10, 11).ch, 'd');
            assert.equal(requireScreenCell(10, 11).attr, cell);
            assert.equal(game.flags.hilite_pet, name !== 'none');
        });
    }
    void test(`full options shows petattr:${name} and its preselected attribute`, async () => {
        freshObjectRoom();
        applyNethackrc(`OPTIONS=petattr:${name}`);
        const { row, picker } = await selectFullOption('petattr', '\x1b');
        assert.match(row, new RegExp(`petattr +\\[${name}\\]`));
        assert.match(picker, /Select pet highlight attribute/);
        assert.match(picker, new RegExp(`${key} \\* ${name}`));
    });
    void test(`full options changes petattr to ${name} and redraws the pet without a turn`, async () => {
        freshObjectRoom({ flags: { hilite_pet: true } });
        const pet = await createMonsterAt('little dog', 11, 10);
        pet.mtame = 10;
        newsym(11, 10);
        await flush_screen(1);
        const { picker } = await selectFullOption('petattr', key);
        await flush_screen(1);
        assert.match(picker, /Select pet highlight attribute/);
        assert.equal(requireScreenCell(10, 11).attr, cell);
        assert.equal(game.flags.hilite_pet, name !== 'none');
        assert.equal(game.moves, 40);
        assert.equal(game.context.move, 0);
    });
}
void test('NETHACKOPTIONS overrides config pet highlighting in native right-to-left order', async () => {
    const config = parseNethackrc('OPTIONS=petattr:underline', {
        nethackOptions: 'petattr:bold,!hilite_pet',
    });
    freshObjectRoom({ flags: config.flags, iflags: config.iflags });
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 10;
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).attr, ATR_BOLD);
    assert.equal(game.flags.hilite_pet, true);
});
void test('petattr:none clears hilite_pet and enabling it restores inverse', async () => {
    freshObjectRoom({ flags: { hilite_pet: true } });
    applyNethackrc('OPTIONS=petattr:none');
    assert.equal(game.flags.hilite_pet, false);
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 10;
    await selectFullOption('hilite_pet', '\x1b');
    await flush_screen(1);
    assert.equal(game.flags.hilite_pet, true);
    assert.equal(requireScreenCell(10, 11).attr, ATR_INVERSE);
    const { row } = await selectFullOption('petattr', '\x1b');
    assert.match(row, /petattr +\[inverse\]/);
});
void test('disabling and enabling hilite_pet preserves the chosen pet attribute', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=petattr:underline');
    await selectFullOption('hilite_pet', '\x1b');
    assert.equal(game.flags.hilite_pet, false);
    await selectFullOption('hilite_pet', '\x1b');
    const { row } = await selectFullOption('petattr', '\x1b');
    assert.match(row, /petattr +\[underline\]/);
    assert.equal(game.flags.hilite_pet, true);
});
for (const value of ['sparkly', 'bold+inverse', 'bold&underline']) {
    void test(`invalid petattr:${value} reports an error and preserves highlighting`, async () => {
        freshObjectRoom();
        applyNethackrc('OPTIONS=petattr:underline');
        const pet = await createMonsterAt('little dog', 11, 10);
        pet.mtame = 10;
        const result = applyNethackrc(`OPTIONS=petattr:${value}`);
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(result.configErrors[0]?.errors[0]?.message, `Unknown petattr parameter 'petattr:${value}'`);
        assert.equal(game.flags.hilite_pet, true);
        assert.equal(requireScreenCell(10, 11).attr, ATR_UNDERLINE);
    });
}
void test('bare petattr reports a missing parameter and enables the default highlight', () => {
    const config = parseNethackrc('OPTIONS=petattr');
    assert.equal(config.configErrors[0]?.errors[0]?.message, "Missing parameter for 'petattr'");
    assert.equal(config.flags.hilite_pet, true);
});
for (const { value, name, cell } of [
    { value: 'normal', name: 'none', cell: 0 },
    { value: 'u_line', name: 'underline', cell: ATR_UNDERLINE },
    { value: 'Re-VerSe', name: 'inverse', cell: ATR_INVERSE },
]) {
    void test(`petattr:${value} renders its attribute and shows the canonical name ${name}`, async () => {
        freshObjectRoom();
        applyNethackrc(`OPTIONS=petattr:${value}`);
        const pet = await createMonsterAt('little dog', 11, 10);
        pet.mtame = 10;
        newsym(11, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(10, 11).attr, cell);
        const { row } = await selectFullOption('petattr', '\x1b');
        assert.match(row, new RegExp(`petattr +\\[${name}\\]`));
    });
}
void test('configuration can enable hilite_pet after petattr:none', async () => {
    const config = parseNethackrc('OPTIONS=hilite_pet,petattr:none');
    freshObjectRoom({ flags: config.flags, iflags: config.iflags });
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 10;
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(game.flags.hilite_pet, true);
    assert.equal(requireScreenCell(10, 11).attr, ATR_INVERSE);
});
void test('an explicit hilite_pet disable keeps the configured attribute for later', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=!hilite_pet,petattr:bold');
    const pet = await createMonsterAt('little dog', 11, 10);
    pet.mtame = 10;
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(game.flags.hilite_pet, false);
    assert.equal(requireScreenCell(10, 11).attr, 0);
    await selectFullOption('hilite_pet', '\x1b');
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).attr, ATR_BOLD);
});
void test('cancelling petattr leaves hilite_pet disabled and the stored attribute intact', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=!hilite_pet,petattr:blink');
    const { row } = await selectFullOption('petattr', '\x1b');
    assert.match(row, /petattr +\[blink\]/);
    assert.equal(game.flags.hilite_pet, false);
});
//# sourceMappingURL=petattr_option.test.js.map