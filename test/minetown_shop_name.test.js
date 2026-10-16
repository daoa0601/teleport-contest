import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOPBASE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { generateMinetown } from '../js/mklev.js';
import { shopkeeperName } from '../js/monster_name.js';
import { freshSpecialLevel } from './support/special-level.js';
for (const town of [true, false]) {
    void test(`the lighting shop uses ${town ? 'Izchak' : 'an ordinary name'} when the dungeon town flag is ${town}`, async () => {
        const active = freshSpecialLevel({ prototype: 'minetn', variant: 4, seed: 67, depth: 6 });
        requirePlayingGame(game);
        game.mines_dnum = 0;
        const descriptor = game.specialLevels?.get('minetn');
        assert.ok(descriptor);
        descriptor.flags.town = town;
        await generateMinetown(active);
        const keeper = game.level.monsters.find(monster => monster.isshk && monster.eshk?.shoptype === SHOPBASE + 11);
        assert.ok(keeper, 'the level must contain a staffed lighting shop');
        if (town) {
            assert.equal(shopkeeperName(keeper), 'Izchak');
            assert.equal(keeper.female, false);
        }
        else {
            assert.notEqual(shopkeeperName(keeper), 'Izchak', 'a town layout alone must not grant the special shopkeeper identity');
        }
    });
}
//# sourceMappingURL=minetown_shop_name.test.js.map