import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('blind lava entry shows the felt lava while the fatal message waits for acknowledgement', async () => {
    const level = freshObjectRoom({ flags: { bones: false, tombstone: false, disclose: '-i -a -v -c -o' } });
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = LAVAPOOL;
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    newsym(ux, uy);
    await flush_screen(1);
    const input = resetInputState();
    let lavaAtDeath;
    input.beforeRead = () => {
        if (lavaAtDeath === undefined && game._pending_message?.includes('burn to a crisp')) {
            lavaAtDeath = requireGameDisplay().grid[uy + 1]?.[ux - 1]?.ch;
        }
    };
    installPagerInput(input, { expected: /fall into|burn to a crisp|Goodbye|points|You were/, limit: 8 });
    await heroLiquidEffects();
    assert.equal(lavaAtDeath, '}');
});
//# sourceMappingURL=lava_entry_display.test.js.map