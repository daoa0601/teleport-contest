import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { NO_MINVENT } from '../js/const.js';
import { pushKeys } from '../js/input.js';
import { msummon } from '../js/minion.js';
import { MONSTER_FLAGS2 } from '../js/monster_data.js';
import { resumeDeferredMovementSpell, runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom } from './support/playable-room.js';

const M2_DEMON = 0x00000100;

for (const cancelled of [false, true]) {
    test(`a ${cancelled ? 'cancelled demon cannot summon' : 'demon can summon'} help during an attack`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        const demon = await createMonsterAt('water demon', 11, 10, NO_MINVENT);
        demon.mpeaceful = false;
        demon.mcan = cancelled;
        pushKeys(' '.repeat(40));

        await runMonsterAction(demon, game, () => 0, count => count, () => 1);

        const summoned = game.level.monsters.filter(monster => monster !== demon);
        assert.equal(summoned.length > 0, !cancelled);
        assert.ok(summoned.every(monster => MONSTER_FLAGS2[monster.mnum] & M2_DEMON));
        assert.ok(game.u.uhp < game.u.uhpmax, 'the demon should also attack');
    });
}

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
    const wizard = await createMonsterAt('Wizard of Yendor', 12, 10);
    wizard.mux = game.u.ux;
    wizard.muy = game.u.uy;
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
