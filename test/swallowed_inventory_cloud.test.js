import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { CLUB, CORPSE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { createHarmlessGasCloudSelection } from '../js/regions.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
for (const poisonous of [false, true]) {
    void test(`swallowed pickup inspection describes the hero in ${poisonous ? 'poison gas' : 'vapor'}`, async () => {
        freshPlayableRoom();
        game.plname = 'Hero';
        installPolymorphedHero('flesh golem', { blindTurns: 20 });
        const worm = await createMonsterAt('purple worm', 10, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        await addObjectToMonsterInventory(worm, await knownObject(CLUB));
        await addObjectToMonsterInventory(worm, await knownObject(CORPSE, {
            initialize: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'),
        }));
        const cloud = createHarmlessGasCloudSelection(game, [{ x: 10, y: 10 }]);
        assert.ok(cloud);
        cloud.damage = poisonous ? 8 : 0;
        game.u.uswallow = 1;
        game.u.ustuck = worm;
        const input = resetInputState();
        // Feeling the corpse changes a flesh golem into stone, so inspection
        // can continue to the creature description without killing the hero.
        await answerPrompts(rhack(','.charCodeAt(0)), input, [
            { prompt: /You try to feel[\s\S]*--More--/, keys: ' ' },
            { prompt: /You touched the cockatrice corpse[\s\S]*--More--/, keys: ' ' },
            { prompt: /You turn into a stone golem![\s\S]*--More--/, keys: ' ' },
            { prompt: new RegExp(`stone golem called [\\s\\S]*, in a cloud of ${poisonous ? 'poison gas' : 'vapor'}`), keys: ' ' },
        ]);
        assert.ok(!game.program_state.gameover);
        assert.ok(game.u.umonnum !== undefined);
        assert.equal(MONSTER_NAME[game.u.umonnum], 'stone golem');
    });
}
//# sourceMappingURL=swallowed_inventory_cloud.test.js.map