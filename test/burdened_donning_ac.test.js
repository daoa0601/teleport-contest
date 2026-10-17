import assert from 'node:assert/strict';
import test from 'node:test';
import { findArmorClass } from '../js/armor.js';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { KICKING_BOOTS, LARGE_BOX } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { nearCapacity } from '../js/weight.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
// C allmain.c moveloop_core() calls find_ac() only after its movement loop
// ends with the hero able to act.  While a burdened hero is still putting on
// boots, the monsters' extra turns see and show the old armor class.
void test('a burdened hero keeps the old armor class until the boots are on', async () => {
    const input = freshTurnRoom({ hero: { uhp: 500, uhpmax: 500 } });
    while (nearCapacity(game) < 1)
        await addInventoryObject(LARGE_BOX);
    assert.equal(nearCapacity(game), 1, 'the hero is merely Burdened');
    const boots = await addInventoryObject(KICKING_BOOTS, { spe: 1 });
    for (const [x, y] of [[11, 10], [9, 10], [10, 11], [10, 9]])
        await createMonsterAt('jackal', x, y, NO_MINVENT);
    const before = findArmorClass();
    initRng(5n);
    const observed = [];
    input.beforeRead = () => {
        observed.push({
            ac: game.u.uac,
            finished: /You finish your dressing maneuver/.test(game._lastPlineMessage ?? ''),
        });
    };
    input.feed(`W${boots.invlet}`);
    for (let core = 0; core < 4; core++) {
        input.feed(' '.repeat(12) + '\x1b');
        await moveloop_core();
    }
    const finishedAt = observed.findIndex(read => read.finished);
    assert.ok(finishedAt > 1, 'monster prose paged while the boots were going on');
    assert.ok(observed.slice(1, finishedAt).every(read => read.ac === before), JSON.stringify(observed));
    assert.equal(game.uarmf, boots);
    assert.equal(game.u.uac, before - 2);
});
//# sourceMappingURL=burdened_donning_ac.test.js.map