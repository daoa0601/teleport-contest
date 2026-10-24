import assert from 'node:assert/strict';
import test from 'node:test';
import { A_CON, A_STR, POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { AMULET_OF_LIFE_SAVING, LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshGameplayRoom } from './support/playable-room.js';
const noDisplay = {
    recalculateVision: () => { },
    resetVision: () => { },
    repaint: () => { },
};
function poolAtHero() {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = POOL;
    game.u.acurr.a[A_STR] = 3;
    game.u.acurr.a[A_CON] = 3;
    game.u.uhp = 20;
    return level;
}
// C trap.c:5189: the life-saving rescue runs safe_teleds(TELEDS_TELEPORT),
// and teleds() prints the verbose "You materialize in ... location!" line
// for every teleport-flagged relocation (teleport.c:545-547).
void test('a life-saved drowning hero still materializes audibly at the rescue spot', async () => {
    const level = poolAtHero();
    requireFixtureGame(game);
    level.requireAt(20, 5).typ = ROOM;
    await addInventoryObject(LEATHER_ARMOR, { oclass: 3 });
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        oclass: 5, worn: true,
    });
    game.uamul = amulet;
    game.u.uamul = amulet;
    game._helplessTurns = 5; // a helpless hero cannot crawl out of the pool
    const messages = [];
    await heroLiquidEffects({
        ...noDisplay,
        publish: async (message) => messages.push(message),
        random: range => range === 21 ? 5 : range - 1,
        rollDice: () => 10,
        rollOne: () => 20,
        die: async () => assert.fail('life saving should prevent death'),
    });
    const text = messages.join(' | ');
    assert.match(text, /You materialize in a different location!/, text);
    assert.deepEqual([game.u.ux, game.u.uy], [20, 5]);
});
//# sourceMappingURL=drown_rescue_materialize.test.js.map