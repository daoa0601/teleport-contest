import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { msummon } from '../js/minion.js';
import {
    MONSTER_FLAGS2, MONSTER_NAME,
} from '../js/monster_data.js';
import { resumeDeferredMovementSpell } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { addMonster } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

const M2_DEMON = 0x00000100;

test('the Wizard summons demons beside the hero', async () => {
    freshGameplayRoom();
    initRng(1n);

    const result = await msummon();

    assert.equal(result.count, 2);
    assert.ok(result.created.every(monster =>
        (MONSTER_FLAGS2[monster.mnum] & M2_DEMON)
        && Math.max(
            Math.abs(monster.mx - game.u.ux),
            Math.abs(monster.my - game.u.uy),
        ) === 1));
});

test('a monster spell completes its demon summon in Gehennom', async () => {
    freshGameplayRoom();
    game.dungeons = [{ flags: { hellish: true } }];
    const wizard = addMonster({
        mnum: MONSTER_NAME.indexOf('Wizard of Yendor'),
        x: 12,
        y: 10,
        mux: game.u.ux,
        muy: game.u.uy,
        hitPoints: 100,
    });
    const action = {
        monster: wizard,
        calls: [],
        movement: {
            deferredAfterMovementSpell: true,
            spellCast: {
                spell: 'summon-monsters',
                deferredSpellEffect: true,
            },
        },
    };
    initRng(11n);

    const result = await resumeDeferredMovementSpell(action, game);

    assert.ok(result.count > 0);
    assert.ok(result.created.every(monster =>
        MONSTER_FLAGS2[monster.mnum] & M2_DEMON));
});
