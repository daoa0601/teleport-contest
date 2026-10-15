import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { POT_SICKNESS, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('sickness potions report a weakened carrying capacity before their HP damage', async () => {
    let physicalAttributeLosses = 0;
    for (let seed = 1n; seed <= 16n; seed++) {
        freshObjectRoom({ hero: { uhp: 40, uhpmax: 40 } });
        requirePlayingGame(game);
        game._moveloopStarted = true;
        await addInventoryObject(ROCK, { quan: 60 });
        const potion = await addInventoryObject(POT_SICKNESS);
        assert.equal(nearCapacity(game), 0);
        game._encumbranceLevel = 0;
        const hero = game.u;
        const hpAtLoadPager = [];
        const input = resetInputState();
        input.beforeRead = () => {
            if (nearCapacity(game) > 0)
                hpAtLoadPager.push(hero.uhp);
        };
        initRng(seed);
        input.feed(`${potion.invlet}${' '.repeat(60)}`);
        await rhack('q'.charCodeAt(0));
        if (nearCapacity(game) === 0)
            continue;
        physicalAttributeLosses++;
        assert.equal(hpAtLoadPager[0], 40, `load feedback precedes damage (seed ${seed})`);
        assert.ok(hero.uhp < 40);
    }
    assert.ok(physicalAttributeLosses > 0, 'the drinks must include a physical attribute loss');
});
//# sourceMappingURL=attribute_load_order.test.js.map