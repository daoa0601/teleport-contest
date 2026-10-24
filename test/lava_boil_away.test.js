import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
// C trap.c:6922-6934: a polymorphed water elemental, steam vortex, or fog
// cloud "boils away" in lava instead of burning to a crisp, and the
// life-saving rescue at 6957 announces rescued_from_terrain(BURNING).
void test('a water elemental in lava boils away and hears the burning rescue message', async () => {
    const level = freshRoomWithPolymorphedHero('water elemental', { flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    level.requireAt(10, 10).typ = LAVAPOOL;
    const lines = [];
    const input = resetInputState();
    const burning = heroLiquidEffects({ publish: async (message) => { lines.push(message); } });
    await input.waitUntilBlocked();
    input.feed('n');
    try {
        const result = await burning;
        assert.ok(result?.entered);
        assert.equal(result.died, false);
        const text = lines.join(' | ');
        assert.match(text, /You boil away\.\.\./, 'the water elemental boils instead of crisping');
        assert.match(text, /You find yourself (?:on top of|in|on) |Back on |You are back on /, 'rescued_from_terrain(BURNING) must follow the rescue');
        assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL, 'the rescue teleported the hero out of the lava');
    }
    finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});
// Unpolymorphed heroes keep the ordinary crisp line (C trap.c:6933).
void test('an unpolymorphed hero still burns to a crisp in lava', async () => {
    freshObjectRoom({ flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    const level = game.level;
    if (!level)
        throw new Error('the object room level is missing');
    level.requireAt(10, 10).typ = LAVAPOOL;
    const lines = [];
    const input = resetInputState();
    const burning = heroLiquidEffects({ publish: async (message) => { lines.push(message); } });
    await input.waitUntilBlocked();
    input.feed('n');
    try {
        await burning;
        const text = lines.join(' | ');
        assert.match(text, /You burn to a crisp\.\.\./);
        assert.doesNotMatch(text, /You boil away/);
    }
    finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});
//# sourceMappingURL=lava_boil_away.test.js.map