import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { CLR_GRAY } from '../js/terminal.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('terrain inspection reveals a gray harmless cloud beneath an adjacent monster', async () => {
    freshObjectRoom({ flags: { tips: false, color: true } });
    await createMonsterAt('jackal', 11, 10);
    assert.ok(createHarmlessGasCloudSelection(game, [{ x: 11, y: 10 }]));
    newsym(11, 10);
    const input = resetInputState();
    input.feed('\x7fb');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const cloud = requireScreenCell(10, 11);
        assert.equal(cloud.ch, '#');
        assert.equal(cloud.color, CLR_GRAY);
    }
    finally {
        input.feed('\x1b ');
        await action;
    }
});
//# sourceMappingURL=terrain_cloud_color.test.js.map