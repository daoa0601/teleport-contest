import assert from 'node:assert/strict';
import test from 'node:test';
import { finishOrdinaryDeath } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the hero announces rising as undead even when bones are disabled', async () => {
    freshObjectRoom({ flags: {
            bones: false, debug: true, disclose: '-i -a -v -g -c -o', tombstone: false,
        } });
    game.u.ugrave_arise = MONSTER_NAME.indexOf('gnome zombie');
    const input = resetInputState();
    const ending = finishOrdinaryDeath({ killer: 'a zombie' });
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    try {
        assert.match(text, /Your body rises from the dead as a gnome zombie\.\.\.--More--/);
    }
    finally {
        input.feed(' '.repeat(10));
        await ending;
    }
});
//# sourceMappingURL=undead_death_feedback.test.js.map