import test from 'node:test';
import assert from 'node:assert/strict';

import { createFireExplosion } from '../js/fire_explosion.js';
import { game } from '../js/gstate.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('a fire explosion burns the hero and monsters in adjacent squares',
    async () => {
        freshGameplayRoom();
        game.u.uhp = game.u.uhpmax = 100;
        const monster = addMonster({
            mnum: 12, x: 11, y: 10, hitPoints: 20,
        });

        await createFireExplosion(11, 10, 5, {
            heroCaused: false,
            publish: async () => {},
            applyFloor: async () => {},
            damageHeroInventory: async () => 0,
            damageMonsterInventory: async () => 0,
            burnMonsterArmor: async () => {},
            burnHeroArmor: async () => {},
            ignite: async () => {},
        });

        assert.equal(game.u.uhp, 95);
        assert.equal(monster.mhp, 15);
    });
