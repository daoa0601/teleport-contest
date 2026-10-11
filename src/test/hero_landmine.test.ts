import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { LANDMINE, PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { triggerHeroTrap } from '../js/hero_traps.js';
import { pushKeys } from '../js/input.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING } from '../js/object_data.js';
import { heroIsPolymorphed } from '../js/polyself.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const lifesaving of [false, true] as const) {
    void test(`a land mine ${lifesaving ? 'continues the explosion after life saving' : 'does not continue the explosion after permanent death'}`, async () => {
        freshObjectRoom({ hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        const mine = addTrap(game.level, LANDMINE, 10, 10);
        const sleeper = await createMonsterAt('jackal', 12, 10);
        sleeper.msleeping = 1;
        if (lifesaving)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_LIFE_SAVING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(mine);

        assert.equal(!!game.program_state.gameover, !lifesaving);
        assert.equal(mine.ttyp, PIT);
        assert.equal(sleeper.msleeping, lifesaving ? 0 : 1);
        if (lifesaving) {
            assert.ok(game.u.uhp > 0);
            assert.equal(game.u.utraptype, TT_PIT);
        } else assert.equal(game._deathKiller, 'land mine');
    });
}

for (const unchanging of [false, true] as const) {
    void test(`a land mine destroying the monster body ${unchanging ? 'kills an unchanging hero before the blast tail' : 'rehumanizes the hero before the pit fall'}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requireFixtureGame(game);
        installPolymorphedHero('giant ant', { hitPoints: 1, maxHitPoints: 100 });
        const mine = addTrap(game.level, LANDMINE, 10, 10);
        const sleeper = await createMonsterAt('jackal', 12, 10);
        sleeper.msleeping = 1;
        if (unchanging)
            await wearHeroAccessory(await addInventoryObject(AMULET_OF_UNCHANGING), 'uamul');
        pushKeys(' '.repeat(100));
        initRng(1n);

        await triggerHeroTrap(mine);

        assert.equal(!!game.program_state.gameover, unchanging);
        assert.equal(sleeper.msleeping, unchanging ? 1 : 0);
        if (unchanging)
            assert.equal(game._deathKiller, 'killed while stuck in creature form');
        else {
            assert.equal(heroIsPolymorphed(game), false);
            assert.equal(game.u.utraptype, TT_PIT);
            assert.ok(game.u.uhp > 0 && game.u.uhp < 100);
        }
    });
}
