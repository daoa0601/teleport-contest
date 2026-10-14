import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { SACK } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
for (const blind of [false, true]) {
    void test(`floor loot ${blind ? 'keeps a bag unobserved while blind' : 'recognizes unseen bags before selecting a container'}`, async () => {
        freshPlayableRoom({ hero: { blindTurns: blind ? 20 : 0 } });
        const first = await floorObject(SACK, 10, 10, { initialize: false, dknown: false });
        const second = await floorObject(SACK, 10, 10, { initialize: false, dknown: false });
        const input = resetInputState();
        await answerPrompts(runExtendedCommand('loot'), input, [
            { prompt: blind ? /Loot which containers\?[\s\S]*an uncursed bag/ : /Loot which containers\?[\s\S]*an uncursed sack/, keys: '\x1b' },
        ]);
        assert.equal(first.dknown, !blind);
        assert.equal(second.dknown, !blind);
        assert.equal(game._encounteredObjectTypes?.has(SACK) ?? false, !blind);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=container_loot_observation.test.js.map