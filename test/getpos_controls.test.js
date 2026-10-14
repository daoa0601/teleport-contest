import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc } from '../js/options.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
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
void test('getpos toggles automatic descriptions off and on', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const input = resetInputState();
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        describe: () => 'floor of a room',
    }), input, [
        { prompt: /Pick a location\./, keys: '#' },
        { prompt: /Automatic description is off\./, keys: 'l' },
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
        { prompt: /Automatic description is off\./, keys: '\x1b' },
    ]);
    applyNethackrc('OPTIONS=autodescribe');
    input.feed('l');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /floor of a room/, keys: '\x1b' },
    ]);
});
//# sourceMappingURL=getpos_controls.test.js.map