import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { drainHeroEnergy } from '../js/hero_energy.js';
import { heroLiquidEffects } from '../js/hack.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { freshObjectRoom } from './support/object-room.js';
// C trap.c:5127-5128: drown()'s escape roll uses Luck (u.uluck + u.moreluck),
// so a luckstone always carries a lucky teleporter out of the water.
void test('a luckstone makes every drowning escape roll trigger the teleport spell', async () => {
    for (let seed = 1n; seed <= 12n; seed++) {
        const level = freshObjectRoom({ hero: { ulevel: 14, uen: 60, uenmax: 60 } });
        for (let x = 9; x <= 11; x++) {
            for (let y = 9; y <= 11; y++)
                level.requireAt(x, y).typ = POOL;
        }
        grantIntrinsicProperty('teleportation', 'outside');
        game.u.uluck = 0;
        game.u.moreluck = 2;
        const messages = [];
        let died = false;
        initRng(seed);
        const result = await heroLiquidEffects({
            publish: async (message) => { messages.push(message); },
            chooseTeleportDestination: async () => ({ x: 15, y: 10 }),
            die: async () => { died = true; },
        });
        assert.ok(result);
        assert.equal(died, false, `seed ${seed} must escape before drowning: ${messages.join(' | ')}`);
        assert.ok(messages.includes('You attempt a teleport spell.'), `seed ${seed} must attempt the spell: ${messages.join(' | ')}`);
    }
});
// C trap.c:5205+5218+5243: drain_en() applies its exclamation to the fully
// drained hero's lethargy line too.
void test('a fully drained energy well reads the lethargic exclamation', async () => {
    freshObjectRoom({ hero: { uen: 0, uenmax: 0 } });
    const exclaimed = drainHeroEnergy(game, 4, { maximumAlreadyDrained: true });
    const plain = drainHeroEnergy(game, 4, { maximumAlreadyDrained: false });
    assert.equal(exclaimed, 'You feel momentarily lethargic!');
    assert.equal(plain, 'You feel momentarily lethargic.');
});
//# sourceMappingURL=terrain_rescue_details.test.js.map