import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { reviveCorpseImmediately } from '../js/corpse_revival.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { DAGGER, OIL_LAMP } from '../js/object_data.js';
import { cansee, hasLightSources, vision_recalc } from '../js/vision.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const carriedLamp of [false, true]) {
    void test(`a death drop on an altar refreshes sight with ${carriedLamp ? 'the carried lamp' : 'the dead monster light removed'}`, async () => {
        const level = freshObjectRoom({ context: { mon_moving: true } });
        requirePlayingGame(game);
        for (let x = 7; x <= 16; x++)
            for (let y = 6; y <= 14; y++)
                level.requireAt(x, y).lit = false;
        level.requireAt(13, 10).typ = ALTAR;
        const elemental = await createMonsterAt('fire elemental', 13, 10, MM_NOGRP | NO_MINVENT);
        if (carriedLamp) {
            const lamp = await knownObject(OIL_LAMP, { age: 200 });
            await addObjectToMonsterInventory(elemental, lamp);
            beginObjectBurn(lamp);
        }
        const dagger = await knownObject(DAGGER, { blessed: true });
        await addObjectToMonsterInventory(elemental, dagger);
        vision_recalc(0);
        assert.equal(cansee(14, 10), true);
        pushKeys('   ');
        let sightDuringFlash;
        await finishEnvironmentalMonsterDeath(elemental, game, {
            noCorpse: true,
            publish: async (message) => {
                await plineWithContinuation(message);
                if (message.includes('flash'))
                    sightDuringFlash = cansee(14, 10);
            },
        });
        assert.equal(dagger.where, 'floor');
        assert.equal(sightDuringFlash, carriedLamp, 'the altar message must refresh sight after the monster light is deleted');
        assert.equal(hasLightSources(), carriedLamp);
    });
}
void test('a revived luminous pet illuminates the dungeon again', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    const dragon = await createMonsterAt('baby gold dragon', 13, 10, MM_NOGRP | NO_MINVENT);
    dragon.mtame = 10;
    const death = await finishEnvironmentalMonsterDeath(dragon, game);
    assert.ok(death.corpse);
    vision_recalc(0);
    assert.equal(cansee(14, 10), false);
    const revival = await reviveCorpseImmediately(death.corpse, game);
    vision_recalc(0);
    assert.ok(revival?.monster);
    assert.equal(cansee(revival.monster.mx + 1, revival.monster.my), true);
});
//# sourceMappingURL=monster_death_light.test.js.map