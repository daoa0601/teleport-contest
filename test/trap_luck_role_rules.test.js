import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerChestTrap } from '../js/chest_trap.js';
import { PIT, TT_PIT } from '../js/const.js';
import { createEarthquake } from '../js/earthquake.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { CHEST, LUCKSTONE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a carried luckstone protects against a chest trap through its bonus luck', async () => {
    for (const carryLuckstone of [false, true]) {
        freshObjectRoom({ hero: { uluck: 10, moreluck: 0 } });
        requirePlayingGame(game);
        const chest = await addInventoryObject(CHEST, { otrapped: true });
        if (carryLuckstone)
            await addInventoryObject(LUCKSTONE);
        assert.equal(game.u.moreluck, carryLuckstone ? 3 : 0);
        initRng(7n);
        const result = await triggerChestTrap(chest, { publish: () => { } });
        assert.ok(result);
        assert.equal(result.outcome, carryLuckstone ? 'luck-save' : 'stunning-gas');
        assert.equal((game.u.stunnedTurns ?? 0) > 0, !carryLuckstone);
        assert.equal(chest.otrapped, false);
    }
});
void test('an Archeologist keeps footing during a tremor that throws another role down', async () => {
    async function damageFromTremor(role) {
        const level = freshPlayableRoom({
            role, left: 10, right: 10, top: 10, bottom: 10,
            hero: {
                uhp: 100, uhpmax: 100, uluck: 0, moreluck: 0,
                utrap: 3, utraptype: TT_PIT,
                acurr: { a: [10, 10, 10, 3, 10, 10] },
            },
        });
        requirePlayingGame(game);
        addTrap(level, PIT, 10, 10, { tseen: true });
        initRng(27n);
        await createEarthquake(13);
        assert.equal(game.u.utraptype, TT_PIT);
        return 100 - game.u.uhp;
    }
    const archeologistDamage = await damageFromTremor('archeologist');
    const cavemanDamage = await damageFromTremor('caveman');
    assert.ok(archeologistDamage >= 1 && archeologistDamage <= 2);
    assert.ok(cavemanDamage > 2 && cavemanDamage <= 4);
});
//# sourceMappingURL=trap_luck_role_rules.test.js.map