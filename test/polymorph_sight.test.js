import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym, plineWithContinuation } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { polymonHero } from '../js/polyself.js';
import { heroIsBlind } from '../js/senses.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('an eyeless hero keeps the old map glyph until sight returns after polymorph', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    installPolymorphedHero('large mimic');
    assert.equal(heroIsBlind(), true);
    newsym(game.u.ux, game.u.uy);
    await flush_screen(1);
    const input = resetInputState();
    const pages = [];
    input.beforeRead = () => {
        const grid = requireGameDisplay(game).grid;
        pages.push({
            top: grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '',
            hero: grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch ?? '',
        });
    };
    installPagerInput(input, { expected: /./, limit: 6 });
    await plineWithContinuation(`You feel ${'very '.repeat(5)}strange.`);
    await polymonHero(MONSTER_NAME.indexOf('gnome'));
    const turned = pages.find(page => page.top.includes('You turn into a gnome!'));
    assert.ok(turned, `pages: ${JSON.stringify(pages)} pending: ${game._pending_message}`);
    assert.equal(turned.hero, 'm');
    assert.equal(heroIsBlind(), false);
});
//# sourceMappingURL=polymorph_sight.test.js.map