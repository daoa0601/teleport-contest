import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { continueCountedCommand } from '../js/cmd.js';
import { doeat } from '../js/eat.js';
import { resetInputState } from '../js/input.js';
import { MAGIC_PORTAL, MM_NOGRP, MON_FLOOR, NO_MINVENT, SATIATED } from '../js/const.js';
import { FOOD_RATION } from '../js/object_data.js';
import { vision_recalc } from '../js/vision.js';
import { moveMonsters } from '../js/mon.js';
import type { Monster } from '../js/monster_types.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

// C monmove.c:dochugw() only runs its hero-notices-a-threat check when
// dochug() returned 0. A monster that left the map during its move made
// dochug() return 1 (monmove.c:912 `if (mon_offmap(mtmp)) return 1;`), so it
// can never interrupt the hero's occupation — its stale (0,0) position must
// not be mistaken for a threat standing next to the hero. A monster that
// stays on the map returned 0 and still interrupts (monmove.c:223-235).
async function declinedMealRoom({ withPortal }: { withPortal: boolean }) {
    const level = await freshObjectRoom({
        left: 1, right: 21, top: 1, bottom: 14, heroX: 5, heroY: 5,
        hero: { uhunger: 1450, uhs: SATIATED },
    });
    requireFixtureGame(game);
    // A dwarf saw the migrating minotaur through infravision in the source
    // session, and the hero stood near the map corner where the vision
    // buffer marks the border cells couldsee-able; together that makes the
    // off-map (0,0) position look like a visible threat — the false threat
    // the dochug() return-value gate rejects.
    game.u.infravision = true;
    if (withPortal) addTrap(level, MAGIC_PORTAL, 14, 5);
    // Nine-plus squares east is outside the (BOLT_LIM+1)^2 threat radius, so
    // the monster counts as "too far away before" its move.
    const minotaur = await createMonsterAt('minotaur', 15, 5, MM_NOGRP | NO_MINVENT);
    minotaur.mpeaceful = 0;
    minotaur.msleeping = 0;
    minotaur.mhp = minotaur.mhpmax = 92;
    await vision_recalc(0);

    const food = await addInventoryObject(FOOD_RATION, { age: game.moves });
    assert.ok(food.invlet);
    const input = resetInputState();
    input.display = { async readKey() { return ' '.charCodeAt(0); } };
    input.feed(food.invlet);
    input.beforeRead = () => {
        if ((game._pending_message || '').includes('Continue eating?')) input.feed('n');
    };

    await doeat();

    assert.equal(game._occupation?.key, 'eat-food');
    assert.equal(game.context.victual?.doreset, true);
    minotaur.movement = withPortal ? 12 : 36;
    return { food, minotaur };
}

function monsterLeftMap(monster: Monster) {
    return (monster.mstate ?? MON_FLOOR) !== MON_FLOOR || !monster.mx;
}

void test('a monster leaving the map during its move does not stop a declined meal', async () => {
    const { food, minotaur } = await declinedMealRoom({ withPortal: true });

    await moveMonsters();

    assert.ok(monsterLeftMap(minotaur), 'the minotaur must migrate through the portal');
    assert.equal(game._occupation?.key, 'eat-food',
        'an off-map monster must not interrupt the meal (dochug returned 1, monmove.c:912)');
    assert.doesNotMatch(game._pending_message || '', /You stop eating/);

    // The declined meal still stops through its own occupation tick: the
    // doreset flag set by answering "Continue eating?" with 'n'.
    await continueCountedCommand();

    assert.equal(game._occupation, null);
    assert.match(game._lastPlineMessage, /You stop eating the food ration\./);
    assert.ok((food.oeaten ?? 0) > 0, 'the partly eaten ration must remain');
});

void test('a monster closing in from beyond the threat radius still stops the meal', async () => {
    await declinedMealRoom({ withPortal: false });

    for (let pass = 0; pass < 4 && game._occupation; pass++) await moveMonsters();

    assert.equal(game._occupation, null,
        'an on-map monster returning 0 from dochug() interrupts (monmove.c:223-235)');
    assert.match(game._lastPlineMessage, /You stop eating the food ration\./);
});

void test('an off-map monster loses movement banked before leaving the map', async () => {
    await freshObjectRoom();
    const monster = await createMonsterAt('goblin', 12, 10);
    monster.mx = 0;
    monster.movement = 120;

    await moveMonsters();

    assert.equal(monster.movement, 0);
});
