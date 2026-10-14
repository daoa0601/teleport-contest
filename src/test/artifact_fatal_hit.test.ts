import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArtifactHitToMonster } from '../js/artifact_hit.js';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const name of ['Vorpal Blade', 'The Tsurugi of Muramasa']) {
    void test(`${name} beheading retains fatal damage after a large damage reduction`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('gnome', 12, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        monster.mhp = monster.mhpmax = 10;
        const sword = await artifactObject(name);

        const hit = await applyArtifactHitToMonster(sword, monster, 4, {
            dieRoll: 1, publish: async () => {},
        });

        assert.equal(hit.heroDied, undefined);
        assert.ok(hit.damage !== undefined && hit.damage - 100 > monster.mhp,
            'Native fatal blows survive the damage reductions applied by their callers');
    });
}
