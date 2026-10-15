import assert from 'node:assert/strict';
import test from 'node:test';
import { roguePlayerName } from '../js/monster_given_name.js';
import { initRng } from '../js/rng.js';
void test('Rogue names honor the name entry in ROGUEOPTS', () => {
    const previous = process.env.ROGUEOPTS;
    try {
        process.env.ROGUEOPTS = 'fruit=pear,name=Old Adventurer,color';
        initRng(1n);
        assert.equal(roguePlayerName(), 'Old Adventurer');
    }
    finally {
        if (previous === undefined)
            delete process.env.ROGUEOPTS;
        else
            process.env.ROGUEOPTS = previous;
    }
});
//# sourceMappingURL=rogue_options_name.test.js.map