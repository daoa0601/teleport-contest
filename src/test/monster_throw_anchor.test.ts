import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { MM_ANGRY, MM_NOGRP, MM_NOMSG, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { resetInputState } from '../js/input.js';
import { throwMonsterWeaponAtHero } from '../js/mthrowu.js';
import { DART } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/steal.js';
import { uninitializedObject } from './support/game-objects.js';
import { installPagerInput } from './support/pager-input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshRangedCombatRoom } from './support/ranged-combat.js';

const TEST_MONSTER_FLAGS = MM_ANGRY | MM_NOGRP | MM_NOMSG | MM_NOWAIT | NO_MINVENT;

// C mthrowu.c:monshoot() anchors its volley line with set_msg_xy(mtmp->mx,
// mtmp->my) before pline(), so vpline()'s accessiblemsg prefix names the
// shooter's square.
void test('a visible volley line carries the accessiblemsg anchor of the shooter', async () => {
    await freshRangedCombatRoom({ heroX: 10, heroY: 10, recalculateVision: true });
    requirePlayingGame(game);
    game.context.mon_moving = true;
    game.flags.accessiblemsg = true;
    const input = resetInputState();
    installPagerInput(input, {
        expected: /throws|shoots|hit|miss|Splat|Clonk|clang|snap|poison/,
        limit: 20,
    });
    const shooter = await createMonsterAt('orc', 12, 10, TEST_MONSTER_FLAGS);
    const dart = await uninitializedObject(DART, { quantity: 1, quan: 1 });
    await addObjectToMonsterInventory(shooter, dart, game);

    await throwMonsterWeaponAtHero(shooter, game, dart, { rollOne: () => 1 });
    const said = [...game._messageHistory, game._pending_message].join(' | ');
    assert.match(said, /\(2east\): .* (throws|shoots) /);
});
