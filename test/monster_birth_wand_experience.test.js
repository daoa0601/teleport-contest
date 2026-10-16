import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { useMonsterOffensiveItem } from '../js/monster_offensive_item.js';
import { WAN_MAGIC_MISSILE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
for (const experienced of [false, true]) {
    void test(`a goblin born ${experienced ? 'in Gehennom' : 'in the main dungeon'} ${experienced ? 'can hit' : 'misses'} with its first ray wand`, async () => {
        freshObjectRoom({ left: 7, right: 20, heroX: 14, heroY: 10,
            hero: { uhp: 100, uhpmax: 100, uac: 10 } });
        requirePlayingGame(game);
        game.dungeons = [createDungeon({ dname: experienced ? 'Gehennom' : 'The Dungeons of Doom',
                num_dunlevs: 30, flags: { hellish: experienced } })];
        if (experienced)
            game.valley_level = createSpecialLevel(game.u.uz);
        const goblin = await createMonsterAt('goblin', 10, 10, NO_MINVENT | MM_NOGRP | MM_NOWAIT);
        goblin.mux = 14;
        goblin.muy = 10;
        const wand = await knownObject(WAN_MAGIC_MISSILE, { spe: 3 });
        await addObjectToMonsterInventory(goblin, wand, game);
        const result = await useMonsterOffensiveItem(goblin, { kind: 'ray-wand', object: wand }, {
            state: game, random: bound => bound - 1, rollDice: () => 4,
            publish: () => { },
        });
        assert.equal(result.heroDied, false);
        assert.equal(game.u.uhp, experienced ? 96 : 100);
        assert.equal(goblin.mwandexp, true);
    });
}
//# sourceMappingURL=monster_birth_wand_experience.test.js.map