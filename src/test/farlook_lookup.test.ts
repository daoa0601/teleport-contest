import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { LA_DOWN, LA_UP, STAIRS } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('farlook offers a named monster entry before its species entry', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false, help: true } });
    const kitten = await createMonsterAt('kitten', 11, 10);
    setMonsterGivenName(kitten, 'Oracle');
    newsym(11, 10);
    const input = resetInputState();
    input.feed('/l.');

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /kitten called Oracle.*--More--/, keys: ' ' },
        { prompt: /More info about "oracle"\?/, keys: 'n' },
        { prompt: /More info about "kitten"\?/, keys: 'n' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);

    assert.equal(game.context.move, 0);
});

void test('ordinary farlook offers information about the hero and keeps looking after declining it', async () => {
    freshObjectRoom({ role: 'wizard', flags: { tips: false, verbose: true, help: true } });
    game.plname = 'Aster';
    newsym(game.u.ux, game.u.uy);
    const input = resetInputState();
    input.feed('/');

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /Please move the cursor.*--More--/, keys: ' ' },
        { prompt: /For instructions/, keys: '.' },
        { prompt: /human wizard called Aster\).*--More--/, keys: ' ' },
        { prompt: /More info about "human wizard"\?/, keys: 'n' },
        { prompt: /Pick a monster, object or location\./, keys: '\x1b' },
    ]);

    assert.equal(game.context.move, 0);
});

void test('the typed-name look command opens the encyclopedia without asking for more information', async () => {
    freshObjectRoom({ flags: { tips: false } });
    const input = resetInputState();

    await answerPrompts(rhack('/'.charCodeAt(0)), input, [
        { prompt: /What do you want to look at:/, keys: '?' },
        { prompt: /Specify what\? \(type the word\)/, keys: '  fountain  \r' },
        { prompt: /Fountain.*[\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(game.context.move, 0);
});

for (const [symbol, description] of [
    ['<', 'a staircase up or a ladder up or a branch staircase up or a branch ladder up'],
    ['a', 'an ant or other insect'],
    ['/', 'the interior of a monster or a wand'],
    ['^', 'a trap'],
    [' ', 'a ghost or stone or air'],
    ['`', 'a boulder or an engraving'],
    ['~', 'a long worm tail'],
    ['3', 'unknown creature causing you disquiet'],
    ['.', 'can be many things'],
    ['8', "I've never heard of such things."],
] as const) {
    void test(`typed look describes the default ${JSON.stringify(symbol)} symbol`, async () => {
        freshObjectRoom({ flags: { tips: false, help: false } });
        game.symset = 'DECgraphics';
        const input = resetInputState();
        input.feed(`/?${symbol}\n`);

        if (symbol === '<') {
            await answerPrompts(rhack(0), input, [
                { prompt: /a staircase up or a ladder up[\s\S]*a branch\s+ladder up--More--/, keys: ' ' },
            ]);
        } else {
            await rhack(0);
            await flush_screen(1);
            const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
            assert.ok(message?.endsWith(description), message);
        }
        assert.equal(game.context.move, 0);
    });
}

for (const blind of [false, true]) {
    void test(`typed look describes an unseen creature with blindness=${blind}`, async () => {
        freshObjectRoom({ flags: { help: false }, hero: { blindTurns: blind ? 10 : 0 } });
        const input = resetInputState();
        input.feed('/?I\n');

        await rhack(0);
        await flush_screen(1);

        const message = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trim();
        assert.ok(message?.endsWith(blind ? 'an unseen creature' : 'a remembered, unseen, creature'), message);
    });
}

for (const up of [false, true]) {
    void test(`farlook explains ordinary and branch staircases ${up ? 'up' : 'down'}`, async () => {
        const level = freshObjectRoom({ flags: { tips: false } });
        game.symset = 'DECgraphics';
        const stairs = level.requireAt(11, 10);
        stairs.typ = STAIRS;
        stairs.ladder = up ? LA_UP : LA_DOWN;
        game.stairs = { sx: 11, sy: 10, up, isladder: false,
            tolev: { dnum: 1, dlevel: 1 }, u_traversed: true, next: null };
        newsym(11, 10);
        const input = resetInputState();
        input.feed('l.');

        await rhack(';'.charCodeAt(0));
        await flush_screen(1);

        const description = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
        assert.ok(description);
        const direction = up ? 'up' : 'down';
        assert.ok(description.startsWith(up ? '<' : '>'), description);
        assert.ok(description.includes(`a staircase ${direction} or a branch staircase ${direction}`), description);
        assert.ok(description.includes(`(branch staircase ${direction})`), description);
    });
}
