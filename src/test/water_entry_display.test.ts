import assert from 'node:assert/strict';
import test from 'node:test';
import { MOAT } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { resetInputState } from '../js/input.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('blind water entry maps the felt moat before the sinking message is acknowledged', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = MOAT;
    setHeroBlindnessTurns(10);
    vision_recalc(0);
    newsym(ux, uy);
    await flush_screen(1);
    const input = resetInputState();
    let glyphWhileSinking: string | undefined;
    input.beforeRead = () => {
        if (game._pending_message?.includes('sink like a rock'))
            glyphWhileSinking = requireGameDisplay().grid[uy + 1]?.[ux - 1]?.ch;
    };
    installPagerInput(input, { expected: /fall into|sink|crawl|close/, limit: 4 });

    const result = await heroLiquidEffects();

    assert.equal(result?.died, false);
    assert.equal(glyphWhileSinking, '}');
});
