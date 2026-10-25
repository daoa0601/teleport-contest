import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

// C trap.c:6936 and 7021 rescue a life-saved hero from lava through
// safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT), whose teleds() tail
// prints the verbose arrival line (teleport.c:545-547) before the landing
// effects run.
void test('a lava life-save rescue announces the materialize line', async () => {
    freshObjectRoom({ flags: { debug: true, bones: false, disclose: '-i -a -v -g -c -o' } });
    const level = game.level;
    if (!level) throw new Error('the object room level is missing');
    level.requireAt(10, 10).typ = LAVAPOOL;
    const lines: string[] = [];
    const input = resetInputState();
    const burning = heroLiquidEffects(
        { publish: async message => { lines.push(message); } });
    await input.waitUntilBlocked();
    input.feed('n');
    try {
        const result = await burning;
        assert.ok(result?.entered);
        assert.equal(result.died, false);
        const text = lines.join(' | ');
        assert.match(text, /You burn to a crisp\.\.\./);
        assert.match(text, /You materialize in (?:a different|the same) location!/,
            'the rescue teleport is a TELEDS_TELEPORT arrival');
        assert.notEqual(level.requireAt(game.u.ux, game.u.uy).typ, LAVAPOOL,
            'the rescue teleported the hero out of the lava');
    } finally {
        input.feed(' '.repeat(20));
        await burning;
    }
});
