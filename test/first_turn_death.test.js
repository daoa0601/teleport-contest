import assert from 'node:assert/strict';
import test from 'node:test';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';
void test('a first-turn death gives its parting message before the bones question', async () => {
    freshObjectRoom({ moves: 1, flags: {
            debug: true, disclose: '-i -a -v -g -c -o', tombstone: false,
        } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    const input = resetInputState();
    const ending = finishOrdinaryDeath({ killer: 'molten lava' });
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Do not pass Go\.  Do not collect 200 zorkmids\.--More--/);
    }
    finally {
        input.feed(' n' + ' '.repeat(10));
        await ending;
    }
});
//# sourceMappingURL=first_turn_death.test.js.map