import assert from 'node:assert/strict';
import test from 'node:test';

import { game, requirePlayingGame } from '../js/gstate.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';

// options.c:optfn_roguesymset() stores the name, loads it from the symbols
// file, and reports the same load failure as the primary symset option;
// "default" clears the choice.
void test('the roguesymset option loads a rogue symbol set by name', () => {
    const loaded = parseNethackrc('OPTIONS=roguesymset:RogueIBM');
    assert.equal(loaded.rogueSymset, 'RogueIBM');
    assert.equal(loaded.configErrors[0]?.errors.length, 0);

    // Case is preserved like optfn_symset()'s dupstr(op).
    assert.equal(parseNethackrc('OPTIONS=roguesymset:Rogueibm').rogueSymset, 'Rogueibm');
});

void test('the roguesymset option reverts to default with an error for unknown sets', () => {
    const missing = parseNethackrc('OPTIONS=roguesymset:NOSUCHSET');
    assert.equal(missing.rogueSymset, undefined);
    assert.deepEqual(missing.configErrors[0]?.errors.map(error => error.message),
        ['Unable to load symbol set "NOSUCHSET" from "symbols"']);

    for (const alias of ['default', 'Default Symbols', 'default-symbols']) {
        const cleared = parseNethackrc(`OPTIONS=roguesymset:${alias}`);
        assert.equal(cleared.rogueSymset, undefined, alias);
        assert.equal(cleared.configErrors[0]?.errors.length, 0, alias);
    }
});

void test('a bare roguesymset element fails silently like parseoptions()', () => {
    const bare = parseNethackrc('OPTIONS=roguesymset');
    assert.equal(bare.rogueSymset, undefined);
    assert.equal(bare.configErrors[0]?.errors.length, 0);
});

void test('the rogue set choice survives into the live state', () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');

    assert.equal(game.rogueSymset, 'RogueEpyx');

    applyNethackrc('OPTIONS=roguesymset:default');
    assert.equal(game.rogueSymset, null);
});
