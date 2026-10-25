import assert from 'node:assert/strict';
import test from 'node:test';
import { displaySelf, flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { POT_HEALING } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { farlookText } from './support/farlook.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('farlook identifies the potion class through the RogueIBM symbol', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueIBM');
    await floorObject(POT_HEALING, 11, 10);
    newsym(11, 10);
    await flush_screen(1);
    assert.equal(requireScreenCell(10, 11).ch, '\xad');
    const text = await farlookText('l.');
    assert.match(text, /a potion \(/, text);
});
void test('farlook identifies the human class through the RogueEpyx hero symbol', async () => {
    freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    applyNethackrc('OPTIONS=roguesymset:RogueEpyx');
    displaySelf();
    await flush_screen(1);
    assert.equal(requireScreenCell(game.u.ux - 1, game.u.uy + 1).ch, '\x01');
    const text = await farlookText('.');
    assert.match(text, /a human or elf/, text);
});
//# sourceMappingURL=farlook_selected_symbols.test.js.map