import assert from 'node:assert/strict';
import test from 'node:test';

import { MIGR_EXACT_XY, MIGR_RANDOM, MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { glyphAt } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { deliverMigratingMonsters, migrateMonsterOffLevel } from '../js/monster_migration.js';
import { initRng } from '../js/rng.js';
import { relocateMonsterTo } from '../js/teleport.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const warning of [false, true]) {
    for (const mode of [MIGR_EXACT_XY, MIGR_RANDOM]) {
        void test(`a ${mode === MIGR_RANDOM ? 'random' : 'direct'} migrant retains its placement's hallucinated ${warning ? 'warning' : 'monster'} appearance`, async () => {
            async function prepareMonster() {
                const level = await freshObjectRoom({
                    right: 30,
                    hero: { hallucinationTurns: 20, warning },
                });
                // Restrict random migrants to the same destination as direct ones.
                level.downTeleportRegion = { lx: 14, ly: 10, hx: 14, hy: 10 };
                const monster = await createMonsterAt('troll', 25, 10,
                    MM_ANGRY | MM_NOGRP | NO_MINVENT);
                monster.minvis = warning;
                return monster;
            }

            const teleported = await prepareMonster();
            initRng(17n);
            await relocateMonsterTo(teleported, 14, 10);
            const expected = glyphAt(14, 10);
            assert.equal(expected?.kind, warning ? 'warning' : 'monster');

            const migrant = await prepareMonster();
            requirePlayingGame(game);
            await migrateMonsterOffLevel(migrant, game, { dst: { ...game.u.uz } }, {
                mode, coordinate: { x: 14, y: 10 },
            });
            initRng(17n);

            const delivered = await deliverMigratingMonsters(game);

            assert.equal(delivered, 1);
            assert.equal(migrant.mx, 14);
            assert.equal(migrant.my, 10);
            // C mon_arrive() leaves the appearance drawn by rloc_to_core(),
            // just as a teleport does; finishing arrival does not reroll it.
            assert.equal(glyphAt(14, 10)?.glyph, expected?.glyph);
        });
    }
}
