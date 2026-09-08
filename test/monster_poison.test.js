import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, A_DEX, A_STR, NO_MINVENT, W_ARMC, W_WEP } from '../js/const.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { CLOAK_OF_PROTECTION, DART } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [species, attribute] of [['quasit', A_DEX], ['rabid rat', A_CON]]) {
    test(`${species} poison harms its target attribute rather than Strength`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
        monster.mpeaceful = false;
        const before = game.u.acurr.a[attribute];
        const strength = game.u.acurr.a[A_STR];
        pushKeys('                    ');

        await runMonsterAction(monster, game, () => 0, count => count, () => 1);

        assert.ok(game.u.acurr.a[attribute] < before);
        assert.equal(game.u.acurr.a[A_STR], strength);
    });
}

test('armor cancellation and a cancelled attacker stop natural poison', async () => {
    const damage = [];
    for (const protection of ['none', 'armor', 'cancelled attacker']) {
        freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
        const spider = await createMonsterAt('giant spider', 10, 10, NO_MINVENT);
        tameMonster(spider, game);
        spider.mcan = protection === 'cancelled attacker';
        const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        soldier.mpeaceful = false;
        if (protection === 'armor')
            equipMonsterObject(soldier, knownObject(CLOAK_OF_PROTECTION), W_ARMC);
        const health = soldier.mhp;
        pushKeys('                    ');

        await runMonsterAction(spider, game, () => 0, count => count, () => 1);

        damage.push(health - soldier.mhp);
    }

    assert.ok(damage[1] > 0, 'cancellation should not prevent the bite itself');
    assert.ok(damage[0] > damage[1], 'unblocked poison should add damage');
    assert.equal(damage[2], damage[1]);
});

test('weapon poison still works when its wielder is cancelled and the defender wears protection', async () => {
    const damage = [];
    for (const poisoned of [false, true]) {
        freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
        const captain = await createMonsterAt('captain', 10, 10, NO_MINVENT);
        tameMonster(captain, game);
        captain.mcan = true;
        equipMonsterObject(captain, knownObject(DART, { opoisoned: poisoned }), W_WEP);
        const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
        giant.mpeaceful = false;
        equipMonsterObject(giant, knownObject(CLOAK_OF_PROTECTION), W_ARMC);
        const health = giant.mhp;
        pushKeys('                    ');

        await runMonsterAction(captain, game, () => 0, count => count, () => 1);

        damage.push(health - giant.mhp);
    }

    assert.ok(damage[0] > 0);
    assert.ok(damage[1] > damage[0], 'weapon poison must bypass magic cancellation');
});

test('poison resistance stops extra poison damage without preventing the bite', async () => {
    const damage = [];
    for (const cancelled of [false, true]) {
        freshObjectRoom({ heroX: 18, right: 20, flags: { verbose: false } });
        const spider = await createMonsterAt('giant spider', 10, 10, NO_MINVENT);
        tameMonster(spider, game);
        spider.mcan = cancelled;
        const ghoul = await createMonsterAt('ghoul', 11, 10, NO_MINVENT);
        ghoul.mpeaceful = false;
        const health = ghoul.mhp;
        pushKeys('                    ');

        await runMonsterAction(spider, game, () => 0, count => count, () => 1);

        damage.push(health - ghoul.mhp);
    }

    assert.ok(damage[0] > 0);
    assert.equal(damage[0], damage[1]);
});
