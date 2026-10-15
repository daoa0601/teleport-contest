import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { shopkeeperRepairsDamage } from '../js/shop_damage.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createStaffedShop } from './support/shop.js';
void test('a shopkeeper repairs a web spun in the shop after the hero moves away', async () => {
    freshMonsterAbilityRoom('giant spider');
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop({ keeperX: 13, keeperY: 10 });
    const x = game.u.ux;
    const y = game.u.uy;
    await runMonsterAbilityCommand('                        ');
    const web = game.level.traps.find(trap => trap.tx === x && trap.ty === y);
    assert.ok(web);
    game.u.ux++;
    game.moves += 10;
    await shopkeeperRepairsDamage(shopkeeper, game);
    assert.equal(game.level.traps.includes(web), false);
});
//# sourceMappingURL=polymorph_shop_web.test.js.map