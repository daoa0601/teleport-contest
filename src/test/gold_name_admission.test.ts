import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldObject, setHeroGoldAmount } from '../js/hero_gold.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { requireScreenRow } from './support/screen.js';

void test('a queued inventory naming choice rejects gold without asking for a name', async t => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('i$');
    planInput(input, t, []);

    await rhack('#'.charCodeAt(0));

    assert.equal(heroGoldObject(game)?.oextra?.oname, undefined);
    assert.equal(game.context.move, 0);
});

void test('gold has no item naming action', async () => {
    freshObjectRoom();
    setHeroGoldAmount(game, 37);
    const input = resetInputState();
    let actions = '';
    input.beforeRead = () => {
        actions = Array.from({ length: 15 }, (_, row) =>
            requireScreenRow(row).map(cell => cell.ch).join('')).join('\n');
    };

    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Coins/, keys: '$' },
        { prompt: /Do what with/, keys: '\x1b' },
    ]);

    assert.doesNotMatch(actions, /Name this stack of gold/);
});
