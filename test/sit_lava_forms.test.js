import test from 'node:test';
import assert from 'node:assert/strict';
import { LAVAPOOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runExtendedCommand } from './support/commands.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
for (const [form, likesLava] of [
    ['fire vortex', false], ['flaming sphere', false],
    ['fire elemental', true], ['salamander', true],
]) {
    void test(`sitting in lava as a ${form} ${likesLava ? 'feels warm' : 'still burns the fire-resistant body'}`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        installPolymorphedHero(form, { hitPoints: 100 });
        level.requireAt(10, 10).typ = LAVAPOOL;
        // The air level lets even an always-levitating form reach its floor.
        game.air_level = createSpecialLevel({ ...game.u.uz });
        await runExtendedCommand('sit', ' '.repeat(10));
        if (likesLava) {
            assert.equal(game.u.mh, 100);
            assert.match(game._pending_message, /lava feels warm/);
        }
        else {
            assert.ok(game.u.mh >= 80 && game.u.mh < 100);
            assert.match(game._pending_message, /lava burns you/);
        }
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=sit_lava_forms.test.js.map