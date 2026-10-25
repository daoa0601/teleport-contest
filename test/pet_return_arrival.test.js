import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOGRP, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { distmin } from '../js/hacklib.js';
import { collectLevelFollowers } from '../js/monster_followers.js';
import { deliverMigratingMonsters } from '../js/monster_migration.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshConnectedLevels } from './support/connected-levels.js';
for (const [seed, claimsHeroSquare] of [[11n, true], [1n, false]]) {
    void test(`a returning pet ${claimsHeroSquare ? 'claims' : 'stays beside'} the hero's square on arrival (seed ${seed})`, async () => {
        freshConnectedLevels();
        requirePlayingGame(game);
        const dog = await createMonsterAt('little dog', game.u.ux + 1, game.u.uy, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        initializePet(dog);
        const followers = await collectLevelFollowers(game);
        assert.equal(followers.length, 1);
        initRng(seed);
        assert.equal(await deliverMigratingMonsters(game, followers), 1);
        if (claimsHeroSquare) {
            assert.equal(dog.mx, game.u.ux);
            assert.equal(dog.my, game.u.uy);
        }
        else {
            assert.notEqual(dog.mx === game.u.ux && dog.my === game.u.uy, true);
            assert.equal(distmin(dog.mx, dog.my, game.u.ux, game.u.uy), 1);
        }
    });
}
//# sourceMappingURL=pet_return_arrival.test.js.map