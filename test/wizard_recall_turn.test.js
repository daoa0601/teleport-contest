import assert from 'node:assert/strict';
import test from 'node:test';
import { MIGR_RANDOM, NO_MINVENT, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { migrateMonsterOffLevel } from '../js/monster_migration.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_YENDOR, SACK } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishSpellTurn } from './support/monster-spells.js';
import { freshObjectRoom } from './support/object-room.js';
for (const anotherWizard of [false, true]) {
    void test(`harassment recalls a Wizard with a bagged Amulet${anotherWizard ? ' while another Wizard is present' : ''}`, async () => {
        let recalled = false;
        for (let seed = 1; seed <= 32 && !recalled; seed++) {
            freshObjectRoom({ hero: { uevent: { udemigod: true }, udg_cnt: 1 } });
            requirePlayingGame(game);
            game.level.flags.rndmongen = false;
            const wizard = await createMonsterAt('Wizard of Yendor', 12, 10, NO_MINVENT);
            const sack = await knownObject(SACK);
            await addObjectToMonsterInventory(wizard, sack);
            await addObjectToContainer(sack, await knownObject(AMULET_OF_YENDOR));
            await migrateMonsterOffLevel(wizard, game, { dst: { dnum: 0, dlevel: 9 } }, { mode: MIGR_RANDOM });
            game.moves += 60;
            if (anotherWizard) {
                game.level.requireAt(40, 10).typ = ROOM;
                const other = await createMonsterAt('Wizard of Yendor', 40, 10, NO_MINVENT);
                other.msleeping = 1;
                other.movement = 0;
            }
            const messages = await finishSpellTurn(seed);
            if (/couldst elude me/.test(messages)) {
                assert.ok(game.level.monsters.includes(wizard));
                assert.equal(game._migratingMonsters?.includes(wizard), false);
                assert.ok(sack.contents?.some(object => object.otyp === AMULET_OF_YENDOR));
                recalled = true;
            }
        }
        assert.ok(recalled, 'A container does not satisfy native mon_has_amulet()');
    });
}
//# sourceMappingURL=wizard_recall_turn.test.js.map