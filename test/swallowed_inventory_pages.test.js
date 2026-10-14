import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { CLUB, CORPSE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
void test('swallowed pickup inspection restarts object selectors on every page', async () => {
    freshPlayableRoom();
    installPolymorphedHero('flesh golem', { blindTurns: 20 });
    const worm = await createMonsterAt('purple worm', 10, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    for (let index = 0; index < 60; index++) {
        await addObjectToMonsterInventory(worm, await knownObject(CLUB, {
            oextra: { oname: `club ${index + 1}` },
        }));
    }
    await addObjectToMonsterInventory(worm, await knownObject(CORPSE, {
        initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
    }));
    game.u.uswallow = 1;
    game.u.ustuck = worm;
    const input = resetInputState();
    await answerPrompts(rhack(','.charCodeAt(0)), input, [
        { prompt: /You try to feel[\s\S]*--More--/, keys: ' ' },
        { prompt: /You touched the cockatrice corpse[\s\S]*--More--/, keys: ' ' },
        { prompt: /You turn into a stone golem![\s\S]*--More--/, keys: ' ' },
        { prompt: /a - .*club[\s\S]*\(1 of 3\)/, keys: '>' },
        { prompt: /a - .*club[\s\S]*\(2 of 3\)/, keys: '>' },
        { prompt: /a - .*club[\s\S]*Swallowed Creatures[\s\S]*\(3 of 3\)/, keys: ' ' },
    ]);
    assert.equal(worm.minvent.length, 61);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=swallowed_inventory_pages.test.js.map