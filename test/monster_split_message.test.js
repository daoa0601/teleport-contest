import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { applyHeroContactPassive } from '../js/monster_passive.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
// potion.c split_mon(): a spotted monster announces its division, naming
// whose heat fed it.  uhitm.c passive() passes the hero for brown mold.
void test('a brown mold fed by the hero\'s heat multiplies from your heat', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.uhp = game.u.uhpmax = 200;
    const mold = await createMonsterAt('brown mold', game.u.ux + 1, game.u.uy);
    mold.mhp = mold.mhpmax = 60;
    const messages = [];
    await applyHeroContactPassive(mold, {
        hit: true,
        random: () => 1,
        rollDice: (count, sides) => count * sides,
        publish: message => { messages.push(message); },
    });
    assert.equal(game.level.monsters.filter(monster => monster.mnum === mold.mnum).length, 2, messages.join(' | '));
    assert.deepEqual(messages.slice(-2), ['You are suddenly very cold!', 'The brown mold multiplies from your heat!']);
});
//# sourceMappingURL=monster_split_message.test.js.map