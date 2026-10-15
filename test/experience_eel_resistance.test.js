import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { NO_MINVENT, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { EXPENSIVE_CAMERA, OBJECT_NAMES } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('magical breathing removes the drowning bonus from giant-eel photograph experience', async () => {
    const awards = [];
    for (const breathing of [false, true]) {
        const level = freshObjectRoom({ role: 'tourist', hero: { ulevel: 30, uexp: 0 } });
        requirePlayingGame(game);
        level.requireAt(12, 10).typ = POOL;
        const eel = await createMonsterAt('giant eel', 12, 10, NO_MINVENT);
        eel.mundetected = 0;
        eel.msleeping = 1;
        if (breathing) {
            await wearHeroAccessory(await addInventoryObject(OBJECT_NAMES.indexOf('amulet of magical breathing')), 'uamul');
            assert.equal(game.u.magicalBreathing, true);
        }
        const camera = await addInventoryObject(EXPENSIVE_CAMERA, { spe: 1 });
        await applyInventoryObject(camera, `l${' '.repeat(30)}`);
        awards.push(game.u.uexp);
    }
    const [vulnerable, protectedHero] = awards;
    assert.ok(vulnerable !== undefined && protectedHero !== undefined);
    assert.equal(vulnerable - protectedHero, 1000);
});
//# sourceMappingURL=experience_eel_resistance.test.js.map