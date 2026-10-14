import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { CORR, DOOR, D_NODOOR, FOUNTAIN, SCORR, STONE, VWALL } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { ATR_BOLD, ATR_INVERSE, ATR_NONE, CLR_RED, NO_COLOR } from '../js/terminal.js';

void test('area filtering cycles to targets across connected stone and walls', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { blindTurns: 5 } });
    for (const [x, typ] of [[10, STONE], [11, VWALL], [12, STONE], [13, VWALL]] as const) {
        const location = level.requireAt(x, 10);
        location.typ = typ;
        location.seenv = 255;
    }
    game.iflags.getloc_filter = 2;
    resetInputState().feed('z.');

    const target = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        isValidLocation: (x, y) => x === 13 && y === 10,
    });

    assert.equal(target?.x, 13, 'Known stone and walls belong to the same connected target area');
    assert.equal(target?.y, 10);
});

void test('area filtering cycles to targets across connected secret corridors', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { blindTurns: 5 } });
    for (const [offset, typ] of [STONE, SCORR, SCORR, VWALL].entries()) {
        const location = level.requireAt(10 + offset, 10);
        location.typ = typ;
        location.seenv = 255;
    }
    game.iflags.getloc_filter = 2;
    resetInputState().feed('z.');

    const target = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        isValidLocation: (x, y) => x === 13 && y === 10,
    });

    assert.equal(target?.x, 13, 'Known secret corridors connect stone and wall targeting areas');
    assert.equal(target?.y, 10);
});

void test('getpos can use a menu to choose a shown monster', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    await createMonsterAt('kitten', 11, 10);
    newsym(11, 10);
    const input = resetInputState();
    input.feed('!m');
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a monster.', goal: 'a monster',
        describe: async () => 'kitten',
    }), input, [
        { prompt: /Pick a monster[\s\S]*a - kitten/, keys: 'a' },
        { prompt: /kitten/, keys: '.' },
    ]);
    assert.equal(selected?.x, 11);
    assert.equal(selected?.y, 10);
});

void test('quick-look menus gather the new area after reversing direction in a doorway', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { detectMonsters: true } });
    for (let y = 6; y <= 14; y++) {
        level.requireAt(10, y).typ = VWALL;
        for (let x = 11; x <= 16; x++) level.requireAt(x, y).typ = CORR;
    }
    const doorway = level.requireAt(10, 10);
    doorway.typ = DOOR;
    doorway.doormask = D_NODOOR;
    await createMonsterAt('kitten', 11, 10);
    await createMonsterAt('little dog', 8, 10);
    newsym(11, 10);
    newsym(8, 10);
    game.iflags.getloc_filter = 2;
    game.iflags.getloc_usemenu = true;
    const input = resetInputState();
    input.feed('lm');

    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /Pick a monster in this area[\s\S]*a - kitten/, keys: 'a' },
        { prompt: /kitten/, keys: 'hm' },
        { prompt: /Pick a monster in this area[\s\S]*a - peaceful little dog/, keys: 'a' },
        { prompt: /little dog/, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
});

void test('getpos toggles automatic descriptions off and on', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const input = resetInputState();
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        describe: () => 'floor of a room',
    }), input, [
        { prompt: /Pick a location\./, keys: '#' },
        { prompt: /Move cursor to a location:/, keys: 'l' },
        { prompt: /Move cursor to a location:/, keys: '#' },
        { prompt: /Automatic description is on\./, keys: '.' },
    ]);
    assert.equal(selected?.x, 11);
});

void test('getpos can limit target cycling to creatures in sight', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false }, hero: { detectMonsters: true } });
    const distant = await createMonsterAt('kitten', 30, 10);
    newsym(distant.mx, distant.my);
    const input = resetInputState();
    input.feed('"m.');
    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a monster.', goal: 'a monster',
    });
    assert.equal(selected?.x, game.u.ux);
    assert.equal(selected?.y, game.u.uy);
});

void test('getpos fast movement can stop at the end of similar terrain', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const input = resetInputState();
    input.feed('*L.');
    const selected = await selectMapPosition({
        start: { x: 11, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    });
    assert.equal(selected?.x, 16);
});

void test('configured whatis_menu opens the monster menu during quick look', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    await createMonsterAt('kitten', 11, 10);
    newsym(11, 10);
    applyNethackrc('OPTIONS=whatis_menu');
    const input = resetInputState();
    input.feed('m');

    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /Pick a monster[\s\S]*a - kitten/, keys: 'a' },
        { prompt: /kitten/, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
});

for (const [style, attr, color] of [
    ['default', ATR_INVERSE, NO_COLOR], ['bold', ATR_BOLD, NO_COLOR],
    ['red', ATR_INVERSE, CLR_RED], ['bold red', ATR_BOLD, CLR_RED],
] as const) {
    void test(`quick-look target menu uses ${style} prompt styling`, async () => {
        freshObjectRoom({ flags: { tips: false, verbose: false } });
        await createMonsterAt('kitten', 11, 10);
        newsym(11, 10);
        applyNethackrc('OPTIONS=whatis_menu');
        if (style !== 'default') game.iflags.menu_headings = { attr, color };
        const input = resetInputState();
        input.feed('m');
        const operation = rhack(';'.charCodeAt(0));
        await input.waitUntilBlocked();
        try {
            for (const [text, expectedAttr, expectedColor] of [
                ['Pick a monster', attr, color], ['a - kitten', ATR_NONE, NO_COLOR],
            ] as const) {
                const row = requireGameDisplay().grid.find(cells => cells.map(cell => cell.ch).join('').includes(text));
                assert.ok(row, `The menu displays "${text}"`);
                const column = row.map(cell => cell.ch).join('').indexOf(text);
                for (const cell of row.slice(column, column + text.length)) {
                    assert.equal(cell.attr, expectedAttr, `"${text}" has the expected attribute`);
                    assert.equal(cell.color, expectedColor, `"${text}" has the expected color`);
                }
            }
        } finally {
            input.feed('\x1b\x1b');
            await operation;
        }
        assert.equal(game.context.move, 0);
    });
}

void test('configured whatis_moveskip stops fast movement at similar terrain', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    applyNethackrc('OPTIONS=whatis_moveskip');
    resetInputState().feed('L.');

    const selected = await selectMapPosition({
        start: { x: 11, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    });
    assert.equal(selected?.x, 16);
});

void test('configuring autodescribe takes effect after the cursor toggle', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    applyNethackrc('OPTIONS=autodescribe');
    const input = resetInputState();
    input.feed('#');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /Move cursor to a monster, object or location:/, keys: '\x1b' },
    ]);
    applyNethackrc('OPTIONS=autodescribe');
    input.feed('l');

    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /floor of a room/, keys: '\x1b' },
    ]);
});

void test('target menus describe displayed glyphs without a caller callback', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    await createMonsterAt('kitten', 11, 10);
    level.requireAt(12, 10).typ = FOUNTAIN;
    newsym(11, 10);
    newsym(12, 10);
    const input = resetInputState();
    input.feed('!m');

    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a target.', goal: 'a target',
    }), input, [
        { prompt: /Pick a monster[\s\S]*a - kitten/, keys: 'a' },
        { prompt: /Move cursor to a target:/, keys: 'a' },
        { prompt: /Pick an interesting thing[\s\S]*a - kitten[\s\S]*b - fountain/, keys: 'b' },
        { prompt: /Move cursor to a target:/, keys: '.' },
    ]);
    assert.equal(selected?.x, 12);
    assert.equal(selected?.y, 10);
});
